import { Resource, State } from "../context/types";
import type { ResourceType, StateType } from "../context/types";
import { World } from "../context/world";
import type { UpdateStage } from "./stage";
import {
    isMutParam,
    type SystemAccess,
    type SystemDefinition,
    type SystemFunction,
    type SystemHandle,
    type SystemId,
    type SystemParam,
} from "./system";

/** 系统依赖目标；函数重复注册时必须改用 SystemHandle 消除歧义。 */
export type SystemDependencyTarget = SystemHandle | ((...args: any[]) => void);

/** 注册系统时声明的相对执行顺序。 */
export interface SystemOptions {
    /** 当前系统必须在这些系统之前执行。 */
    readonly before?: SystemDependencyTarget | readonly SystemDependencyTarget[];
    /** 当前系统必须在这些系统之后执行。 */
    readonly after?: SystemDependencyTarget | readonly SystemDependencyTarget[];
}

/** 已解析为系统编号的有向依赖边。 */
export interface SystemDependency {
    readonly before: SystemId;
    readonly after: SystemId;
}

type PendingDependency = {
    readonly owner: SystemHandle;
    readonly relation: "before" | "after";
    readonly target: SystemDependencyTarget;
};

let nextBuilderId = 1;

/** 收集系统、参数和依赖关系并生成不可变调度定义。 */
export class SystemScheduleBuilder {
    private readonly _builderId = nextBuilderId++;
    private readonly _systems: SystemDefinition[] = [];
    private readonly _byFunction = new Map<Function, SystemHandle[]>();
    private readonly _pending: PendingDependency[] = [];
    private _built = false;

    /** 注册系统并返回可用于后续依赖声明的稳定句柄。 */
    addSystem<const Params extends readonly SystemParam[]>(
        stage: UpdateStage,
        fn: SystemFunction<Params>,
        params: Params,
        options: SystemOptions = {},
    ): SystemHandle {
        this.assertMutable();
        const id = this._systems.length as SystemId;
        const handle = Object.freeze({
            id,
            name: fn.name || `System${id}`,
            stage,
            __builderId: this._builderId,
        }) as SystemHandle;
        const definition: SystemDefinition = Object.freeze({
            handle,
            fn,
            params: Object.freeze([...params]),
            registrationIndex: this._systems.length,
            access: this.createAccess(params),
        });
        this._systems.push(definition);
        let handles = this._byFunction.get(fn);
        if (!handles) {
            handles = [];
            this._byFunction.set(fn, handles);
        }
        handles.push(handle);
        this.addPending(handle, "before", options.before);
        this.addPending(handle, "after", options.after);
        return handle;
    }

    /** 声明 `system` 必须在 `target` 之前执行。 */
    before(system: SystemHandle, target: SystemDependencyTarget): this {
        this.assertMutable();
        this._pending.push({ owner: system, relation: "before", target });
        return this;
    }

    /** 声明 `system` 必须在 `target` 之后执行。 */
    after(system: SystemHandle, target: SystemDependencyTarget): this {
        this.assertMutable();
        this._pending.push({ owner: system, relation: "after", target });
        return this;
    }

    /** 按参数顺序建立连续依赖链。 */
    chain(...systems: readonly SystemHandle[]): this {
        this.assertMutable();
        for (let i = 1; i < systems.length; i++) this.before(systems[i - 1], systems[i]);
        return this;
    }

    /** 解析依赖并生成调度定义；Builder 构建后不可再修改。 */
    build(): SystemSchedule {
        this.assertMutable();
        this._built = true;
        const dependencies: SystemDependency[] = [];
        const edgeKeys = new Set<string>();
        for (const pending of this._pending) {
            const target = this.resolveTarget(pending.target);
            this.validateHandle(pending.owner);
            this.validateHandle(target);
            const before = pending.relation === "before" ? pending.owner : target;
            const after = pending.relation === "before" ? target : pending.owner;
            if (before.id === after.id) {
                throw new Error(`System ${before.name} cannot depend on itself`);
            }
            if (before.stage !== after.stage) {
                if (before.stage.order > after.stage.order) {
                    throw new Error(
                        `Dependency contradicts stage order: ${before.name} cannot run before ${after.name}`,
                    );
                }
                continue;
            }
            const key = `${before.id}:${after.id}`;
            if (!edgeKeys.has(key)) {
                edgeKeys.add(key);
                dependencies.push(Object.freeze({ before: before.id, after: after.id }));
            }
        }
        const stages = [...new Set(this._systems.map(system => system.handle.stage))]
            .sort((a, b) => a.order - b.order);
        return new SystemSchedule(
            Object.freeze([...this._systems]),
            Object.freeze(dependencies),
            Object.freeze(stages),
        );
    }

    private createAccess(params: readonly SystemParam[]): SystemAccess {
        const reads = new Set<ResourceType | StateType>();
        const writes = new Set<StateType>();
        const declared = new Set<unknown>();
        let world = false;
        for (const param of params) {
            if (isMutParam(param)) {
                if (declared.has(param.target)) {
                    throw new Error(`System parameter ${param.target.name} is declared more than once`);
                }
                declared.add(param.target);
                writes.add(param.target);
                continue;
            }
            if (declared.has(param)) {
                const name = typeof param === "function" ? param.name : "QueryType";
                throw new Error(`System parameter ${name} is declared more than once`);
            }
            declared.add(param);
            if (param === World) {
                world = true;
            } else if (typeof param === "function" && (
                param.prototype instanceof Resource ||
                param.prototype instanceof State
            )) {
                reads.add(param as ResourceType | StateType);
            }
            // Service controls its own API. Query access is intentionally deferred.
        }
        return Object.freeze({ reads, writes, world });
    }

    private addPending(
        owner: SystemHandle,
        relation: "before" | "after",
        value?: SystemDependencyTarget | readonly SystemDependencyTarget[],
    ): void {
        if (value === undefined) return;
        const values = Array.isArray(value) ? value : [value];
        for (const target of values) this._pending.push({ owner, relation, target });
    }

    private resolveTarget(target: SystemDependencyTarget): SystemHandle {
        if (typeof target !== "function") return target;
        const handles = this._byFunction.get(target);
        if (!handles?.length) {
            throw new Error(`Dependency target ${target.name || "anonymous"} is not registered`);
        }
        if (handles.length !== 1) {
            throw new Error(
                `Dependency target ${target.name || "anonymous"} is registered more than once; use SystemHandle`,
            );
        }
        return handles[0];
    }

    private validateHandle(handle: SystemHandle): void {
        if (this._systems[handle.id]?.handle !== handle) {
            throw new Error(`SystemHandle ${handle.name} does not belong to this builder`);
        }
    }

    private assertMutable(): void {
        if (this._built) throw new Error("SystemScheduleBuilder has already been built");
    }
}

/** 系统定义、依赖边和阶段列表组成的不可变调度快照。 */
export class SystemSchedule {
    /** 使用已解析的系统、依赖和阶段创建不可变调度快照。 */
    constructor(
        readonly systems: readonly SystemDefinition[],
        readonly dependencies: readonly SystemDependency[],
        readonly stages: readonly UpdateStage[],
    ) { Object.freeze(this); }
}
