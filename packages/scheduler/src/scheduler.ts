import type { Schedule, SystemDependency } from "./schedule";
import type { Stage } from "./stage";
import type { SystemParamProvider } from "./system-param-provider";
import type { SystemDefinition, SystemId } from "./system";

/** 已解析参数、可直接调用的运行时系统。 */
export interface RuntimeSystem<Param = unknown> {
    readonly definition: SystemDefinition<Param>;
    readonly args: readonly unknown[];
}

/** 同一阶段内已完成拓扑排序的运行时系统集合。 */
export interface RuntimeStage<Param = unknown> {
    readonly stage: Stage;
    readonly systems: readonly RuntimeSystem<Param>[];
}

interface SortedStage<Param> {
    readonly stage: Stage;
    readonly systems: readonly SystemDefinition<Param>[];
}

enum SchedulerPhase {
    Created,
    Initialized,
    Preparing,
    Prepared,
    PrepareFailed,
    Disposed,
}

/** 对静态调度排序、一次性绑定不透明参数，并按阶段串行执行系统。 */
export class Scheduler<Param = unknown> {
    private _phase = SchedulerPhase.Created;
    private _sortedStages: readonly SortedStage<Param>[] = [];
    private _stages: readonly RuntimeStage<Param>[] = [];
    private _stageLookup = new Map<Stage, RuntimeStage<Param>>();

    constructor(readonly schedule: Schedule<Param>) {}

    /** 仅执行领域无关的依赖校验与稳定拓扑排序。 */
    init(): void {
        if (this._phase !== SchedulerPhase.Created) {
            throw new Error("Scheduler has already been initialized");
        }
        const sortedStages: SortedStage<Param>[] = [];
        for (const stage of this.schedule.stages) {
            const definitions = this.schedule.systems.filter(system => system.handle.stage === stage);
            if (!definitions.length) continue;
            sortedStages.push(Object.freeze({
                stage,
                systems: Object.freeze(this.topologicalSort(definitions, this.schedule.dependencies)),
            }));
        }
        this._sortedStages = Object.freeze(sortedStages);
        this._phase = SchedulerPhase.Initialized;
    }

    /** 在冷路径解析全部固定参数，并在全部成功后原子发布运行时阶段。 */
    prepare(provider: SystemParamProvider<Param>): void {
        if (this._phase !== SchedulerPhase.Initialized) {
            throw new Error(`Scheduler cannot prepare during phase ${SchedulerPhase[this._phase]}`);
        }
        this._phase = SchedulerPhase.Preparing;
        try {
            const stages: RuntimeStage<Param>[] = [];
            const lookup = new Map<Stage, RuntimeStage<Param>>();
            for (const stage of this._sortedStages) {
                const systems: RuntimeSystem<Param>[] = [];
                for (const definition of stage.systems) {
                    const args = definition.params.map(param => provider.resolve(param));
                    systems.push(Object.freeze({
                        definition,
                        args: Object.freeze(args),
                    }));
                }
                const runtime = Object.freeze({
                    stage: stage.stage,
                    systems: Object.freeze(systems),
                });
                stages.push(runtime);
                lookup.set(stage.stage, runtime);
            }
            this._stages = Object.freeze(stages);
            this._stageLookup = lookup;
            this._phase = SchedulerPhase.Prepared;
        } catch (error) {
            this._phase = SchedulerPhase.PrepareFailed;
            throw error;
        }
    }

    /** 按依赖排序串行执行指定阶段；阶段没有系统时不产生效果。 */
    run(stage: Stage): void {
        if (this._phase !== SchedulerPhase.Prepared) {
            throw new Error("Scheduler has not been prepared");
        }
        const runtime = this._stageLookup.get(stage);
        if (!runtime) return;
        const systems = runtime.systems;
        for (let i = 0; i < systems.length; i++) invoke(systems[i]);
    }

    dispose(): void {
        if (this._phase === SchedulerPhase.Disposed) return;
        this._sortedStages = [];
        this._stages = [];
        this._stageLookup.clear();
        this._stageLookup = new Map();
        this._phase = SchedulerPhase.Disposed;
    }

    private topologicalSort(
        definitions: readonly SystemDefinition<Param>[],
        dependencies: readonly SystemDependency[],
    ): SystemDefinition<Param>[] {
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
        const result: SystemDefinition<Param>[] = [];
        const emitted = new Uint8Array(definitions.length);
        while (result.length < definitions.length) {
            let next = -1;
            for (let i = 0; i < definitions.length; i++) {
                if (!emitted[i] && inDegree[i] === 0 && (
                    next === -1 || definitions[i].registrationIndex < definitions[next].registrationIndex
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
