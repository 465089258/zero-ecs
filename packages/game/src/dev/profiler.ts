import { Game } from "../runtime/game";
import { Scheduler, type Stage } from "@zero-ecs/scheduler";
import { GAME_SCHEDULER, gameControl } from "../runtime/game-control";

function padRight(value: string, length: number): string {
    return value.length >= length ? value : value + " ".repeat(length - value.length);
}

interface StageStats {
    total: number;
    count: number;
    max: number;
}

type StageObserver = (stage: Stage, elapsed: number) => void;

interface SchedulerPatch {
    readonly observers: Set<StageObserver>;
    readonly originalRun: Scheduler["run"];
    readonly originalOwnDescriptor: PropertyDescriptor | undefined;
    readonly wrappedRun: Scheduler["run"];
}

const schedulerPatches = new WeakMap<Scheduler, SchedulerPatch>();

/** 开发期 Game 内存与阶段耗时分析器；只包装目标 Game 所属的 Scheduler 实例。 */
export class DevProfiler {
    private _timer: ReturnType<typeof setInterval> | undefined;
    private readonly _stats = new Map<string, StageStats>();
    private _removeObserver: (() => void) | undefined;

    /** 创建分析器并开始收集当前 Game 的 Scheduler 阶段耗时。 */
    constructor(readonly game: Game) {
        const scheduler = gameControl(game)[GAME_SCHEDULER]();
        this._removeObserver = addStageObserver(
            scheduler,
            (stage, elapsed) => { this.record(stage, elapsed); },
        );
    }

    /** 返回按 Archetype 汇总的实体、Chunk 填充率与 Buffer 内存报告。 */
    getMemoryReport(): string {
        let totalEntities = 0;
        let totalMemory = 0;
        let totalLogicalChunks = 0;
        let totalAllocatedChunks = 0;
        let totalSpareChunks = 0;
        const lines = [
            "Archetype Memory:",
            "-------------------------------------------------------------------------------------------------------------",
            padRight("ID", 6) +
            padRight("Components", 48) +
            padRight("Entities", 12) +
            padRight("Chunks L/P/S(Limit)", 24) +
            padRight("Fill", 10) +
            "Memory",
            "-------------------------------------------------------------------------------------------------------------",
        ];
        const archetypes = this.game.world.archetypes;
        for (let i = 0; i < archetypes.length; i++) {
            const archetype = archetypes[i];
            const memory = archetype.allocatedBytes;
            const components = archetype.types.map(type => type.name).join(", ");
            const logicalChunks = archetype.chunks;
            const allocatedChunks = countAllocatedChunks(archetype);
            const spareChunks = allocatedChunks - logicalChunks;
            const capacity = allocatedChunks * archetype.chunkCapacity;
            const fill = capacity === 0 ? "n/a" : `${(archetype.count / capacity * 100).toFixed(1)}%`;
            lines.push(
                padRight(`[${i}]`, 6) +
                padRight(components.slice(0, 45), 48) +
                padRight(String(archetype.count), 12) +
                padRight(
                    `${logicalChunks}/${allocatedChunks}/${spareChunks}` +
                    `(${archetype.spareChunkLimit})`,
                    24,
                ) +
                padRight(fill, 10) +
                this.formatBytes(memory),
            );
            totalEntities += archetype.count;
            totalMemory += memory;
            totalLogicalChunks += logicalChunks;
            totalAllocatedChunks += allocatedChunks;
            totalSpareChunks += spareChunks;
        }
        lines.push("-------------------------------------------------------------------------------------------------------------");
        lines.push(
            `Total entities=${totalEntities}, ` +
            `chunks=${totalLogicalChunks}/${totalAllocatedChunks}/${totalSpareChunks}, ` +
            `memory=${this.formatBytes(totalMemory)}`,
        );
        return lines.join("\n");
    }

    /** 返回当前分析器独立收集的阶段耗时报告。 */
    getPerformanceReport(): string {
        const lines = ["Scheduler Performance:"];
        for (const [name, value] of this._stats) {
            lines.push(
                `${padRight(name, 20)} calls=${value.count} ` +
                `total=${value.total.toFixed(2)}ms ` +
                `avg=${(value.total / value.count).toFixed(3)}ms ` +
                `max=${value.max.toFixed(2)}ms`,
            );
        }
        return lines.join("\n");
    }

    /** 定时向控制台输出内存与性能报告。 */
    startLogging(intervalMs = 5000): void {
        this.stopLogging();
        this._timer = setInterval(() => {
            console.log(`${this.getMemoryReport()}\n${this.getPerformanceReport()}`);
        }, intervalMs);
    }

    /** 停止当前分析器的定时日志。 */
    stopLogging(): void {
        if (this._timer !== undefined) clearInterval(this._timer);
        this._timer = undefined;
    }

    /** 停止日志并解除当前分析器的实例局部观察；重复调用安全。 */
    dispose(): void {
        this.stopLogging();
        this._removeObserver?.();
        this._removeObserver = undefined;
    }

    private record(stage: Stage, elapsed: number): void {
        let stats = this._stats.get(stage.name);
        if (!stats) {
            stats = { total: 0, count: 0, max: 0 };
            this._stats.set(stage.name, stats);
        }
        stats.total += elapsed;
        stats.count++;
        if (elapsed > stats.max) stats.max = elapsed;
    }

    private formatBytes(bytes: number): string {
        if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
        if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
        return `${bytes} B`;
    }
}

function addStageObserver(scheduler: Scheduler, observer: StageObserver): () => void {
    let patch = schedulerPatches.get(scheduler);
    if (!patch) {
        const observers = new Set<StageObserver>();
        const originalRun = scheduler.run;
        const originalOwnDescriptor = Object.getOwnPropertyDescriptor(scheduler, "run");
        const wrappedRun = function (this: Scheduler, stage: Stage): void {
            const start = performance.now();
            try {
                originalRun.call(this, stage);
            } finally {
                const elapsed = performance.now() - start;
                for (const current of observers) current(stage, elapsed);
            }
        };
        patch = {
            observers,
            originalRun,
            originalOwnDescriptor,
            wrappedRun,
        };
        schedulerPatches.set(scheduler, patch);
        Object.defineProperty(scheduler, "run", {
            configurable: true,
            writable: true,
            value: wrappedRun,
        });
    }
    patch.observers.add(observer);

    let active = true;
    return (): void => {
        if (!active) return;
        active = false;
        patch!.observers.delete(observer);
        if (patch!.observers.size !== 0 || schedulerPatches.get(scheduler) !== patch) return;
        schedulerPatches.delete(scheduler);
        if (scheduler.run !== patch!.wrappedRun) return;
        if (patch!.originalOwnDescriptor) {
            Object.defineProperty(scheduler, "run", patch!.originalOwnDescriptor);
        } else {
            delete (scheduler as unknown as { run?: Scheduler["run"] }).run;
        }
    };
}

function countAllocatedChunks(archetype: Game["world"]["archetypes"][number]): number {
    let count = archetype.chunks;
    const maximum = count + archetype.spareChunkLimit;
    while (count < maximum && archetype.chunkAt(count) !== undefined) count++;
    return count;
}
