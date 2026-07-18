import { Resource, Service, State } from "../../context";
import { ErrorHandlerService } from "../../context/error-handler-service";
import { FixedTimeResource } from "../time/fixed-time-resource";
import { TimeState } from "../time/time-state";
import type { Mut } from "../../schedule/system";

/** 分层时间轮的容量与调试配置。 */
export const enum TimerConfig {
    /** 每层时间轮的槽位数，必须为 2 的幂。 */
    SLOT_COUNT = 64,           // 每层槽位数（2 的幂，便于位运算）
    /** 最多保留的空闲任务包装对象数量。 */
    MAX_TASK_POOL_SIZE = 4096,
    /** 是否输出时间轮调试日志。 */
    DEBUG = 0,
}

/** 可由 TimerService 延迟提交的任务。 */
export interface ITimerTask {
    /** 到期时提交任务。 */
    submit(): void;
}

/** 定时器服务的最小接口。 */
export interface ITimer {
    /** 在指定模拟时间后提交一次任务。 */
    once(delaySec: number, task: ITimerTask): void;
}

/** 内部任务表示（存储于时间轮中） */
export interface InnerTask {
    taskObject: ITimerTask;
    targetTick: number;        // 触发时的绝对全局 tick 数
    createTime: number;        // 创建时的虚拟时间（秒）
    expectedTime: number;      // 预期的虚拟触发时间（秒），用于调试
}

/** 时间轮层级 */
export interface TimerLevel {
    slots: InnerTask[][];      // 每个槽位直接存放池化任务，不创建包装节点
    currentSlot: number;       // 当前指针位置
    tickPerSlot: number;       // 每槽代表的基本 tick 数
    totalTicksPerRound: number; // 一整圈的总 tick 数
}

/** 分层时间轮、待执行任务和对象池状态。 */
export class TimerState extends State {
    readonly levels: TimerLevel[] = [];
    readonly globalTick: number = 0;
}

/** @internal 当前 World 的定时任务包装对象池；不属于可恢复模拟状态。 */
export class TimerPoolService extends Service {
    private readonly _tasks: InnerTask[] = [];

    acquire(): InnerTask {
        const task = this._tasks.pop()
            ?? { taskObject: undefined!, targetTick: 0, createTime: 0, expectedTime: 0 };
        task.taskObject = undefined!;
        task.targetTick = 0;
        task.createTime = 0;
        task.expectedTime = 0;
        return task;
    }

    recycle(task: InnerTask): void {
        task.taskObject = undefined!;
        task.targetTick = 0;
        task.createTime = 0;
        task.expectedTime = 0;
        if (this._tasks.length < TimerConfig.MAX_TASK_POOL_SIZE) this._tasks.push(task);
    }

    trim(retain: number): void {
        if (this._tasks.length > retain) this._tasks.length = retain;
    }

    dispose(): void { this._tasks.length = 0; }
}

/** 基于固定 Tick 的分层时间轮定时器。 */
export class TimerService extends Service implements ITimer {
    @Service.inject(ErrorHandlerService) private readonly _errors!: ErrorHandlerService;
    @Service.inject(TimerPoolService) private readonly _pool!: TimerPoolService;
    @Resource.inject(FixedTimeResource) private readonly _fixed!: FixedTimeResource;
    @State.inject(TimeState) private readonly _time!: TimeState;
    @State.inject(TimerState) private readonly _state!: Mut<TimerState>;

    /** 根据当前 TimeState 初始化时间轮。 */
    init() {
        this._state.globalTick = this._time.tick;
        this.createNewLevel(); // 创建第 0 层
        if (TimerConfig.DEBUG) {
            console.log(`[Timer] 初始化，TICK_SEC=${this._fixed.deltaSeconds}, SLOT_COUNT=${TimerConfig.SLOT_COUNT}`);
        }
    }

    /**
     * 延迟提交一次任务。
     *
     * 延迟时间向上取整到固定 Tick，且最少等待一个 Tick；当前不提供取消接口。
     */
    once(delaySec: number, task: ITimerTask): void {
        let ticks = Math.ceil(delaySec / this._fixed.deltaSeconds);
        if (ticks < 1) ticks = 1;

        const wrapper = this._pool.acquire();
        wrapper.taskObject = task;
        wrapper.targetTick = this._state.globalTick + ticks;
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

    /**
     * 核心插入算法（修正版）：
     * - 根据 remaining ticks 选择合适的层级
     * - **使用 currentSlot 计算相对槽位**，而不是绝对偏移
     */
    private addTaskByTargetTick(task: InnerTask): void {
        const remaining = task.targetTick - this._state.globalTick;
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
                this._errors.report(err, "timer", task.taskObject);
            }
            this._pool.recycle(task);
            return;
        }

        // 找到满足 remaining < totalTicksPerRound 的最底层
        let levelIndex = 0;
        while (levelIndex < this._state.levels.length) {
            const level = this._state.levels[levelIndex];
            if (remaining < level.totalTicksPerRound) break;
            levelIndex++;
        }

        // 必要时动态创建更高层级
        while (levelIndex >= this._state.levels.length) {
            this.createNewLevel();
        }

        const level = this._state.levels[levelIndex];
        // ✅ 修正点：槽位 = (当前指针 + 偏移) 再取模
        const delta = Math.floor(remaining / level.tickPerSlot);
        const slot = (level.currentSlot + delta) & (TimerConfig.SLOT_COUNT - 1);
        level.slots[slot].push(task);
    }

    private createNewLevel(): void {
        const newLevelIndex = this._state.levels.length;
        const tickPerSlot = Math.pow(TimerConfig.SLOT_COUNT, newLevelIndex);
        const totalTicksPerRound = tickPerSlot * TimerConfig.SLOT_COUNT;

        const level: TimerLevel = {
            slots: Array.from({ length: TimerConfig.SLOT_COUNT }, () => []),
            currentSlot: 0,
            tickPerSlot,
            totalTicksPerRound,
        };
        this._state.levels.push(level);

        if (TimerConfig.DEBUG) {
            console.log(
                `[Timer] 创建新层级: index=${newLevelIndex}, ` +
                `tickPerSlot=${tickPerSlot}, totalTicksPerRound=${totalTicksPerRound}`
            );
        }
    }

    /** 裁剪空闲任务对象池；不会影响仍在等待的任务。 */
    trimPool(retain = 0): void {
        if (!Number.isSafeInteger(retain) || retain < 0) {
            throw new RangeError("retain must be a non-negative safe integer");
        }
        this._pool.trim(retain);
    }

    /** 清空空闲任务对象池；不会取消仍在等待的任务。 */
    clearPool(): void { this.trimPool(0); }

    /** 取消全部待触发任务并释放时间轮与对象池。 */
    dispose(): void {
        for (let levelIndex = 0; levelIndex < this._state.levels.length; levelIndex++) {
            const slots = this._state.levels[levelIndex].slots;
            for (let slot = 0; slot < slots.length; slot++) slots[slot].length = 0;
        }
        this._state.levels.length = 0;
        this._state.globalTick = 0;
    }
}
