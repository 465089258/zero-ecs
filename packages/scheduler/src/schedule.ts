import { Stage, SystemSet } from "./stage";
import type {
    SystemDefinition,
    SystemFunction,
    SystemHandle,
    SystemId,
} from "./system";

/** 依赖目标可以是系统句柄、唯一注册的函数或构建期 SystemSet。 */
export type SystemDependencyTarget = SystemHandle | SystemFunction | SystemSet;

/** 注册系统时声明的集合归属与相对执行顺序。 */
export interface SystemOptions {
    readonly inSet?: SystemSet | readonly SystemSet[];
    readonly before?: SystemDependencyTarget | readonly SystemDependencyTarget[];
    readonly after?: SystemDependencyTarget | readonly SystemDependencyTarget[];
    readonly beforeIfPresent?: SystemDependencyTarget | readonly SystemDependencyTarget[];
    readonly afterIfPresent?: SystemDependencyTarget | readonly SystemDependencyTarget[];
}

/** 已解析为系统编号的有向依赖边。 */
export interface SystemDependency {
    readonly before: SystemId;
    readonly after: SystemId;
}

interface PendingDependency {
    readonly owner: SystemHandle;
    readonly relation: "before" | "after";
    readonly target: SystemDependencyTarget;
    readonly optional: boolean;
}

let nextBuilderId = 1;

/** 收集领域无关系统、参数和依赖，并生成不可变 Schedule。 */
export class ScheduleBuilder<Param = unknown> {
    private readonly _builderId = nextBuilderId++;
    private readonly _systems: SystemDefinition<Param>[] = [];
    private readonly _byFunction = new Map<Function, SystemHandle[]>();
    private readonly _setMembers = new Map<SystemSet, SystemHandle[]>();
    private readonly _pending: PendingDependency[] = [];
    private _built = false;

    addSystem(
        stage: Stage,
        fn: SystemFunction,
        params: readonly Param[],
        options: SystemOptions = {},
    ): SystemHandle {
        this.assertMutable();
        const sets = normalizeSets(options.inSet);
        for (const set of sets) this.assertSetStage(set, stage);
        const id = this._systems.length as SystemId;
        const handle = Object.freeze({
            id,
            name: fn.name || `System${id}`,
            stage,
            __builderId: this._builderId,
        }) as SystemHandle;
        this._systems.push(Object.freeze({
            handle,
            fn,
            params: Object.freeze([...params]),
            sets: Object.freeze(sets),
            registrationIndex: this._systems.length,
        }));
        let handles = this._byFunction.get(fn);
        if (!handles) {
            handles = [];
            this._byFunction.set(fn, handles);
        }
        handles.push(handle);
        for (const set of sets) {
            let members = this._setMembers.get(set);
            if (!members) {
                members = [];
                this._setMembers.set(set, members);
            }
            members.push(handle);
        }
        this.addPending(handle, "before", options.before, false);
        this.addPending(handle, "after", options.after, false);
        this.addPending(handle, "before", options.beforeIfPresent, true);
        this.addPending(handle, "after", options.afterIfPresent, true);
        return handle;
    }

    before(system: SystemHandle, target: SystemDependencyTarget): this {
        return this.addDependency(system, "before", target, false);
    }

    after(system: SystemHandle, target: SystemDependencyTarget): this {
        return this.addDependency(system, "after", target, false);
    }

    beforeIfPresent(system: SystemHandle, target: SystemDependencyTarget): this {
        return this.addDependency(system, "before", target, true);
    }

    afterIfPresent(system: SystemHandle, target: SystemDependencyTarget): this {
        return this.addDependency(system, "after", target, true);
    }

    chain(...systems: readonly SystemHandle[]): this {
        this.assertMutable();
        for (let i = 1; i < systems.length; i++) this.before(systems[i - 1], systems[i]);
        return this;
    }

    build(): Schedule<Param> {
        this.assertMutable();
        this._built = true;
        const dependencies: SystemDependency[] = [];
        const edgeKeys = new Set<string>();
        for (const pending of this._pending) {
            this.validateHandle(pending.owner);
            const targets = this.resolveTargets(pending.target, pending.optional, pending.owner.stage);
            for (const target of targets) {
                this.validateHandle(target);
                const before = pending.relation === "before" ? pending.owner : target;
                const after = pending.relation === "before" ? target : pending.owner;
                if (before.id === after.id) {
                    throw new Error(`System ${before.name} cannot depend on itself`);
                }
                if (before.stage !== after.stage) {
                    throw new Error(
                        `Cross-stage dependency is not allowed: ${before.name} -> ${after.name}`,
                    );
                }
                const key = `${before.id}:${after.id}`;
                if (!edgeKeys.has(key)) {
                    edgeKeys.add(key);
                    dependencies.push(Object.freeze({ before: before.id, after: after.id }));
                }
            }
        }
        const stages = [...new Set(this._systems.map(system => system.handle.stage))]
            .sort((a, b) => a.order - b.order);
        return new Schedule(
            Object.freeze([...this._systems]),
            Object.freeze(dependencies),
            Object.freeze(stages),
        );
    }

    private addDependency(
        owner: SystemHandle,
        relation: "before" | "after",
        target: SystemDependencyTarget,
        optional: boolean,
    ): this {
        this.assertMutable();
        this._pending.push({ owner, relation, target, optional });
        return this;
    }

    private addPending(
        owner: SystemHandle,
        relation: "before" | "after",
        value: SystemDependencyTarget | readonly SystemDependencyTarget[] | undefined,
        optional: boolean,
    ): void {
        if (value === undefined) return;
        const values = Array.isArray(value) ? value : [value];
        for (const target of values) this._pending.push({ owner, relation, target, optional });
    }

    private resolveTargets(
        target: SystemDependencyTarget,
        optional: boolean,
        ownerStage: Stage,
    ): readonly SystemHandle[] {
        if (target instanceof SystemSet) {
            this.assertSetStage(target, ownerStage);
            return this._setMembers.get(target) ?? [];
        }
        if (typeof target !== "function") return [target];
        const handles = this._byFunction.get(target);
        if (!handles?.length) {
            if (optional) return [];
            throw new Error(`Dependency target ${target.name || "anonymous"} is not registered`);
        }
        if (handles.length !== 1) {
            throw new Error(
                `Dependency target ${target.name || "anonymous"} is registered more than once; use SystemHandle`,
            );
        }
        return handles;
    }

    private validateHandle(handle: SystemHandle): void {
        if (this._systems[handle.id]?.handle !== handle) {
            throw new Error(`SystemHandle ${handle.name} does not belong to this builder`);
        }
    }

    private assertSetStage(set: SystemSet, stage: Stage): void {
        if (set.stage !== stage) {
            throw new Error(`SystemSet ${set.name} belongs to a different Stage`);
        }
    }

    private assertMutable(): void {
        if (this._built) throw new Error("ScheduleBuilder has already been built");
    }
}

/** 系统定义、依赖边和阶段列表组成的不可变调度快照。 */
export class Schedule<Param = unknown> {
    constructor(
        readonly systems: readonly SystemDefinition<Param>[],
        readonly dependencies: readonly SystemDependency[],
        readonly stages: readonly Stage[],
    ) { Object.freeze(this); }
}

function normalizeSets(value: SystemSet | readonly SystemSet[] | undefined): SystemSet[] {
    if (value === undefined) return [];
    return Array.isArray(value) ? [...value] : [value as SystemSet];
}
