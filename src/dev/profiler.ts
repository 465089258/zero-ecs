import { EntityService } from "../ecs/entity/entity-service";
import { Ecs } from "../runtime/ecs";
import { Scheduler, type UpdateStage } from "../schedule";

function padRight(value: string, length: number): string {
    return value.length >= length ? value : value + " ".repeat(length - value.length);
}

let originalSchedulerRun: typeof Scheduler.prototype.run | undefined;
let patchedProfilers = 0;

/** 开发期 ECS 内存与阶段耗时分析器；会临时包装 Scheduler.run。 */
export class DevProfiler {
    private readonly _entities: EntityService;
    private _timer: ReturnType<typeof setInterval> | undefined;
    private static readonly _stats = new Map<string, {
        total: number;
        count: number;
        max: number;
    }>();

    /** 创建分析器并开始收集全部 Scheduler 阶段的耗时。 */
    constructor(readonly ecs: Ecs) {
        this._entities = ecs.service(EntityService);
        this.patchScheduler();
    }

    /** 返回按 Archetype 汇总的实体数量与 Buffer 内存报告。 */
    getMemoryReport(): string {
        let totalEntities = 0;
        let totalMemory = 0;
        const lines = [
            "Archetype Memory:",
            "---------------------------------------------------------------",
            padRight("ID", 6) + padRight("Components", 64) + padRight("Entities", 12) + "Memory",
            "---------------------------------------------------------------",
        ];
        const archetypes = this._entities.archetypes;
        for (let i = 0; i < archetypes.length; i++) {
            const archetype = archetypes[i];
            let memory = 0;
            for (const table of archetype.tables) memory += table.byteLength;
            const components = archetype.types.map(type => type.name).join(", ");
            lines.push(
                padRight(`[${i}]`, 6) +
                padRight(components.slice(0, 61), 64) +
                padRight(String(archetype.count), 12) +
                this.formatBytes(memory),
            );
            totalEntities += archetype.count;
            totalMemory += memory;
        }
        lines.push("---------------------------------------------------------------");
        lines.push(`Total entities=${totalEntities}, memory=${this.formatBytes(totalMemory)}`);
        return lines.join("\n");
    }

    /** 返回进程内所有分析器共享的阶段耗时报告。 */
    getPerformanceReport(): string {
        const lines = ["Scheduler Performance:"];
        for (const [name, value] of DevProfiler._stats) {
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

    /** 停止日志，并在最后一个分析器释放时恢复 Scheduler.run。 */
    dispose(): void {
        this.stopLogging();
        if (patchedProfilers > 0) patchedProfilers--;
        if (patchedProfilers === 0 && originalSchedulerRun) {
            Scheduler.prototype.run = originalSchedulerRun;
            originalSchedulerRun = undefined;
        }
    }

    private patchScheduler(): void {
        if (patchedProfilers++ > 0) return;
        originalSchedulerRun = Scheduler.prototype.run;
        Scheduler.prototype.run = function (this: Scheduler, stage: UpdateStage): void {
            const start = performance.now();
            originalSchedulerRun!.call(this, stage);
            const elapsed = performance.now() - start;
            let stats = DevProfiler._stats.get(stage.name);
            if (!stats) {
                stats = { total: 0, count: 0, max: 0 };
                DevProfiler._stats.set(stage.name, stats);
            }
            stats.total += elapsed;
            stats.count++;
            if (elapsed > stats.max) stats.max = elapsed;
        };
    }

    private formatBytes(bytes: number): string {
        if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
        if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
        return `${bytes} B`;
    }
}
