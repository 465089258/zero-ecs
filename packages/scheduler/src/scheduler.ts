import type { Schedule, SystemDependency } from "./schedule";
import type { Stage } from "./stage";
import type { SystemParamProvider } from "./system-param-provider";
import type {
    SystemDefinition,
    SystemFunction,
    SystemId,
} from "./system";

type SystemRunner = () => void;

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
    private _stageLookup = new Map<Stage, readonly SystemRunner[]>();

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
            const lookup = new Map<Stage, readonly SystemRunner[]>();
            for (const stage of this._sortedStages) {
                const runners: SystemRunner[] = [];
                for (const definition of stage.systems) {
                    const args = definition.params.map(param => provider.resolve(param));
                    runners.push(createRunner(definition.fn, args));
                }
                lookup.set(stage.stage, Object.freeze(runners));
            }
            this._stageLookup = lookup;
            this._sortedStages = [];
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
        const runners = this._stageLookup.get(stage);
        if (!runners) return;
        for (let i = 0; i < runners.length; i++) {
            const runner = runners[i];
            runner();
        }
    }

    dispose(): void {
        if (this._phase === SchedulerPhase.Disposed) return;
        this._sortedStages = [];
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
                const cycle = findDependencyCycle(outgoing, emitted);
                const names = cycle.length === 0
                    ? "unknown"
                    : cycle.map(index => definitions[index].handle.name).join(" -> ");
                throw new Error(`System dependency cycle detected: ${names}`);
            }
            emitted[next] = 1;
            result.push(definitions[next]);
            for (const target of outgoing[next]) inDegree[target]--;
        }
        return result;
    }
}

function findDependencyCycle(
    outgoing: readonly (readonly number[])[],
    emitted: Uint8Array,
): number[] {
    const states = new Uint8Array(outgoing.length);
    const path: number[] = [];
    const positions = new Int32Array(outgoing.length);
    positions.fill(-1);

    interface Frame {
        readonly node: number;
        edge: number;
    }

    for (let start = 0; start < outgoing.length; start++) {
        if (emitted[start] !== 0 || states[start] !== 0) continue;
        const frames: Frame[] = [{ node: start, edge: 0 }];
        states[start] = 1;
        positions[start] = path.length;
        path.push(start);

        while (frames.length > 0) {
            const frame = frames[frames.length - 1];
            const targets = outgoing[frame.node];
            if (frame.edge >= targets.length) {
                states[frame.node] = 2;
                positions[frame.node] = -1;
                frames.pop();
                path.pop();
                continue;
            }

            const target = targets[frame.edge++];
            if (emitted[target] !== 0) continue;
            if (states[target] === 0) {
                states[target] = 1;
                positions[target] = path.length;
                path.push(target);
                frames.push({ node: target, edge: 0 });
                continue;
            }
            if (states[target] === 1) {
                const begin = positions[target];
                return [...path.slice(begin), target];
            }
        }
    }
    return [];
}

function createRunner(fn: SystemFunction, args: unknown[]): SystemRunner {
    switch (args.length) {
        case 0:
            return fn;
        case 1: {
            const a0 = args[0];
            return () => fn(a0);
        }
        case 2: {
            const [a0, a1] = args;
            return () => fn(a0, a1);
        }
        case 3: {
            const [a0, a1, a2] = args;
            return () => fn(a0, a1, a2);
        }
        case 4: {
            const [a0, a1, a2, a3] = args;
            return () => fn(a0, a1, a2, a3);
        }
        case 5: {
            const [a0, a1, a2, a3, a4] = args;
            return () => fn(a0, a1, a2, a3, a4);
        }
        case 6: {
            const [a0, a1, a2, a3, a4, a5] = args;
            return () => fn(a0, a1, a2, a3, a4, a5);
        }
        case 7: {
            const [a0, a1, a2, a3, a4, a5, a6] = args;
            return () => fn(a0, a1, a2, a3, a4, a5, a6);
        }
        case 8: {
            const [a0, a1, a2, a3, a4, a5, a6, a7] = args;
            return () => fn(a0, a1, a2, a3, a4, a5, a6, a7);
        }
        default: {
            const values = Object.freeze(args);
            return () => fn.apply(undefined, values as unknown as any[]);
        }
    }
}
