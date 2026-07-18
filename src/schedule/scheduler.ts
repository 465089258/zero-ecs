import type { InjectionContext } from "../context/injection";
import { Resource, type ResourceType } from "../context/resource";
import { Service, type ServiceType } from "../context/service";
import { State, type StateType } from "../context/state";
import { World } from "../context/world";
import { QueryType } from "../ecs/query/query-type";
import { QueryService } from "../ecs/query/query-service";
import type { SystemDependency, SystemSchedule } from "./schedule";
import type { UpdateStage } from "./stage";
import { isMutParam, type SystemDefinition, type SystemId, type SystemParam } from "./system";

/** 已解析参数、可直接调用的运行时系统。 */
export interface RuntimeSystem {
    readonly definition: SystemDefinition;
    readonly args: readonly unknown[];
}

/** 同一阶段内已完成拓扑排序的运行时系统集合。 */
export interface RuntimeStage {
    readonly stage: UpdateStage;
    readonly systems: readonly RuntimeSystem[];
}

/** 将静态调度绑定到 World，并按阶段串行执行系统。 */
export class Scheduler {
    private readonly _stages: RuntimeStage[] = [];
    private readonly _stageLookup = new Map<UpdateStage, RuntimeStage>();
    private _context: InjectionContext | undefined;

    /** 创建尚未绑定 World 的调度器。 */
    constructor(readonly schedule: SystemSchedule) {}

    /** @internal 由 Ecs 在初始化时绑定注入上下文并编译参数。 */
    init(context: InjectionContext): void {
        if (this._context) throw new Error("Scheduler has already been initialized");
        this._context = context;
        this.compile();
    }

    /** 按依赖排序串行执行指定阶段；阶段没有系统时不产生效果。 */
    run(stage: UpdateStage): void {
        if (!this._context) throw new Error("Scheduler has not been initialized");
        const runtime = this._stageLookup.get(stage);
        if (!runtime) return;
        const systems = runtime.systems;
        for (let i = 0; i < systems.length; i++) invoke(systems[i]);
    }

    /** 释放已解析的运行时系统参数与阶段索引。 */
    dispose(): void {
        this._stages.length = 0;
        this._stageLookup.clear();
        this._context = undefined;
    }

    private compile(): void {
        for (const stage of this.schedule.stages) {
            const definitions = this.schedule.systems.filter(system => system.handle.stage === stage);
            if (!definitions.length) continue;
            const sorted = this.topologicalSort(definitions, this.schedule.dependencies);
            const systems = sorted.map(definition => Object.freeze({
                definition,
                args: Object.freeze(definition.params.map(param => this.resolveParam(param))),
            }));
            const runtime = Object.freeze({ stage, systems: Object.freeze(systems) });
            this._stages.push(runtime);
            this._stageLookup.set(stage, runtime);
        }
    }

    private resolveParam(param: SystemParam): unknown {
        const context = this.context;
        if (isMutParam(param)) return context.states.get(param.target);
        if (param === World) return context.world;
        if (param instanceof QueryType) return context.services.get(QueryService).create(param);
        if (param.prototype instanceof Resource) return context.resources.get(param as ResourceType);
        if (param.prototype instanceof State) return context.states.get(param as StateType);
        if (param.prototype instanceof Service) return context.services.get(param as ServiceType);
        throw new TypeError(`Unsupported system parameter type: ${param.name}`);
    }

    private topologicalSort(
        definitions: readonly SystemDefinition[],
        dependencies: readonly SystemDependency[],
    ): SystemDefinition[] {
        const byId = new Map<SystemId, number>();
        definitions.forEach((definition, index) => byId.set(definition.handle.id, index));
        const outgoing = definitions.map(() => [] as number[]);
        const inDegree = new Uint32Array(definitions.length);
        for (const edge of dependencies) {
            const from = byId.get(edge.before);
            const to = byId.get(edge.after);
            if (from === undefined || to === undefined) continue;
            outgoing[from].push(to);
            inDegree[to]++;
        }
        const result: SystemDefinition[] = [];
        const emitted = new Uint8Array(definitions.length);
        while (result.length < definitions.length) {
            let next = -1;
            for (let i = 0; i < definitions.length; i++) {
                if (!emitted[i] && inDegree[i] === 0 && (
                    next === -1 ||
                    definitions[i].registrationIndex < definitions[next].registrationIndex
                )) next = i;
            }
            if (next === -1) {
                const names = definitions
                    .filter((_, index) => !emitted[index])
                    .map(item => item.handle.name)
                    .join(" -> ");
                throw new Error(`System dependency cycle detected: ${names}`);
            }
            emitted[next] = 1;
            result.push(definitions[next]);
            for (const target of outgoing[next]) inDegree[target]--;
        }
        return result;
    }

    private get context(): InjectionContext {
        if (!this._context) throw new Error("Scheduler has not been initialized");
        return this._context;
    }
}

function invoke(system: RuntimeSystem): void {
    const fn = system.definition.fn;
    const args = system.args;
    switch (args.length) {
        case 0: fn(); break;
        case 1: fn(args[0]); break;
        case 2: fn(args[0], args[1]); break;
        case 3: fn(args[0], args[1], args[2]); break;
        case 4: fn(args[0], args[1], args[2], args[3]); break;
        case 5: fn(args[0], args[1], args[2], args[3], args[4]); break;
        case 6: fn(args[0], args[1], args[2], args[3], args[4], args[5]); break;
        case 7: fn(args[0], args[1], args[2], args[3], args[4], args[5], args[6]); break;
        case 8: fn(args[0], args[1], args[2], args[3], args[4], args[5], args[6], args[7]); break;
        default: fn.apply(undefined, args as unknown as any[]);
    }
}
