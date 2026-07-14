import { Resource, Service, State } from "../../context/types";
import { ArrayPool } from "../../internal/array-pool";
import { FixedTimeResource } from "../time/fixed-time-resource";
import { TimeState } from "../time/time-state";

export const enum TimerConfig {
    SLOT_COUNT = 64,           // 每层槽位数（2 的幂，便于位运算）
    MAX_TASK_POOL_SIZE = 4096,
    DEBUG = 0,
}

/** 可被 Timer 延迟执行的任务对象 */
export interface ITimerTask {
    submit(): void;
}

export interface ITimer {
    once(delaySec: number, task: ITimerTask): void;
}

/** 内部任务表示（存储于时间轮中） */
interface InnerTask {
    taskObject: ITimerTask;
    targetTick: number;        // 触发时的绝对全局 tick 数
    createTime: number;        // 创建时的虚拟时间（秒）
    expectedTime: number;      // 预期的虚拟触发时间（秒），用于调试
}

/** 层级任务（存储在某个层的槽中） */
interface LevelTask {
    task: InnerTask;
    rounds: number;            // 在该层还需等待的完整圈数（当前设计下恒为 0，保留以兼容未来扩展）
}

/** 时间轮层级 */
interface Level {
    slots: LevelTask[][];      // 每个槽位存放 LevelTask 数组
    currentSlot: number;       // 当前指针位置
    tickPerSlot: number;       // 每槽代表的基本 tick 数
    totalTicksPerRound: number; // 一整圈的总 tick 数
}

export class TimerService extends Service implements ITimer {
    @Resource.inject(FixedTimeResource) private readonly _fixed!: FixedTimeResource;
    @State.inject(TimeState) private readonly _time!: TimeState;

    private levels: Level[] = [];
    private globalTick = 0;

    private readonly taskPool: InnerTask[] = [];

    // ------ 初始化 ------
    init() {
        this.globalTick = this._time.tick;
        this.createNewLevel(); // 创建第 0 层
        if (TimerConfig.DEBUG) {
            console.log(`[Timer] 初始化，TICK_SEC=${this._fixed.deltaSeconds}, SLOT_COUNT=${TimerConfig.SLOT_COUNT}`);
        }
    }

    // ------ 公共接口 ------
    once(delaySec: number, task: ITimerTask): void {
        let ticks = Math.ceil(delaySec / this._fixed.deltaSeconds);
        if (ticks < 1) ticks = 1;

        const wrapper = this.acquireTask();
        wrapper.taskObject = task;
        wrapper.targetTick = this.globalTick + ticks;
        wrapper.createTime = this._time.elapsed;
        wrapper.expectedTime = this._time.elapsed + ticks * this._fixed.deltaSeconds;

        if (TimerConfig.DEBUG) {
            console.log(
                `[Timer] 添加任务: 延迟=${delaySec}s -> 折算ticks=${ticks}, ` +
                `目标绝对tick=${wrapper.targetTick}, 预期触发时间=${wrapper.expectedTime.toFixed(3)}s`
            );
        }

        this.addTaskByTargetTick(wrapper);
    }

    // ------ 时间推进 ------
    advance(): void {
        while (this.globalTick < this._time.tick) {
            this.globalTick++;
            this.tick();
        }
    }

    // ------ 核心时间轮逻辑 ------

    private tick(): void {
        const level0 = this.levels[0];
        level0.currentSlot = (level0.currentSlot + 1) & (TimerConfig.SLOT_COUNT - 1);
        this.processSlot(level0, 0);

        if (level0.currentSlot === 0) {
            this.advanceLevel(1);
        }
    }

    private advanceLevel(levelIndex: number): void {
        if (levelIndex >= this.levels.length) return;
        const level = this.levels[levelIndex];
        level.currentSlot = (level.currentSlot + 1) & (TimerConfig.SLOT_COUNT - 1);
        this.processSlot(level, levelIndex);
        if (level.currentSlot === 0) {
            this.advanceLevel(levelIndex + 1);
        }
    }

    /**
     * 处理当前指针所在槽位
     * - 使用 deferredTasks 延迟降级插入，避免修改正在遍历的 bucket
     */
    private processSlot(level: Level, levelIndex: number): void {
        const bucket = level.slots[level.currentSlot];
        if (bucket.length === 0) return;

        const pending: LevelTask[] = ArrayPool.spawn();
        const deferredTasks: InnerTask[] = ArrayPool.spawn();

        for (let i = 0; i < bucket.length; i++) {
            const entry = bucket[i];
            if (entry.rounds > 0) {
                entry.rounds--;
                pending.push(entry);
            } else {
                const task = entry.task;
                if (levelIndex === 0) {
                    // 第 0 层到期 → 直接执行
                    try {
                        task.taskObject.submit();

                        if (TimerConfig.DEBUG) {
                            const actualTime = this._time.elapsed;
                            const error = actualTime - task.expectedTime;
                            console.log(
                                `[Timer] 触发任务: 实际=${actualTime.toFixed(3)}s, ` +
                                `预期=${task.expectedTime.toFixed(3)}s, ` +
                                `误差=${error >= 0 ? '+' : ''}${error.toFixed(6)}s`
                            );
                        }
                    } catch (err) {
                        console.error(err);
                    }
                    this.recycleTask(task);
                } else {
                    // 非 0 层到期 → 降级（延迟插入，避免并发修改）
                    deferredTasks.push(task);
                }
            }
        }

        // 安全恢复未到期任务
        bucket.length = 0;
        for (let i = 0; i < pending.length; i++) {
            bucket.push(pending[i]);
        }
        ArrayPool.despawn(pending);

        // 统一降级插入
        for (let i = 0; i < deferredTasks.length; i++) {
            this.addTaskByTargetTick(deferredTasks[i]);
        }
        ArrayPool.despawn(deferredTasks);
    }

    /**
     * 核心插入算法（修正版）：
     * - 根据 remaining ticks 选择合适的层级
     * - **使用 currentSlot 计算相对槽位**，而不是绝对偏移
     */
    private addTaskByTargetTick(task: InnerTask): void {
        const remaining = task.targetTick - this.globalTick;
        if (remaining <= 0) {
            // 已经过期（防御性直接触发）
            try {
                task.taskObject.submit();
                if (TimerConfig.DEBUG) {
                    const actualTime = this._time.elapsed;
                    console.warn(
                        `[Timer] 任务过期强制触发: 实际=${actualTime.toFixed(3)}s, ` +
                        `预期=${task.expectedTime.toFixed(3)}s`
                    );
                }
            } catch (err) {
                console.error(err);
            }
            this.recycleTask(task);
            return;
        }

        // 找到满足 remaining < totalTicksPerRound 的最底层
        let levelIndex = 0;
        while (levelIndex < this.levels.length) {
            const level = this.levels[levelIndex];
            if (remaining < level.totalTicksPerRound) break;
            levelIndex++;
        }

        // 必要时动态创建更高层级
        while (levelIndex >= this.levels.length) {
            this.createNewLevel();
        }

        const level = this.levels[levelIndex];
        // ✅ 修正点：槽位 = (当前指针 + 偏移) 再取模
        const delta = Math.floor(remaining / level.tickPerSlot);
        const slot = (level.currentSlot + delta) & (TimerConfig.SLOT_COUNT - 1);
        // rounds 恒为 0（因我们保证 remaining < totalTicksPerRound）
        const rounds = 0;

        level.slots[slot].push({ task, rounds });
    }

    private createNewLevel(): void {
        const newLevelIndex = this.levels.length;
        const tickPerSlot = Math.pow(TimerConfig.SLOT_COUNT, newLevelIndex);
        const totalTicksPerRound = tickPerSlot * TimerConfig.SLOT_COUNT;

        const level: Level = {
            slots: Array.from({ length: TimerConfig.SLOT_COUNT }, () => []),
            currentSlot: 0,
            tickPerSlot,
            totalTicksPerRound,
        };
        this.levels.push(level);

        if (TimerConfig.DEBUG) {
            console.log(
                `[Timer] 创建新层级: index=${newLevelIndex}, ` +
                `tickPerSlot=${tickPerSlot}, totalTicksPerRound=${totalTicksPerRound}`
            );
        }
    }

    // ------ 对象池管理 ------

    private acquireTask(): InnerTask {
        let task = this.taskPool.pop();
        if (!task) {
            task = { taskObject: undefined!, targetTick: 0, createTime: 0, expectedTime: 0 };
        }
        task.taskObject = undefined!;
        task.targetTick = 0;
        task.createTime = 0;
        task.expectedTime = 0;
        return task;
    }

    private recycleTask(task: InnerTask): void {
        task.taskObject = undefined!;
        task.targetTick = 0;
        task.createTime = 0;
        task.expectedTime = 0;
        if (this.taskPool.length < TimerConfig.MAX_TASK_POOL_SIZE) {
            this.taskPool.push(task);
        }
    }

    clearPool(): void {
        this.taskPool.length = 0;
    }

    dispose(): void {
        for (let levelIndex = 0; levelIndex < this.levels.length; levelIndex++) {
            const slots = this.levels[levelIndex].slots;
            for (let slot = 0; slot < slots.length; slot++) slots[slot].length = 0;
        }
        this.levels.length = 0;
        this.taskPool.length = 0;
        this.globalTick = 0;
    }
}
