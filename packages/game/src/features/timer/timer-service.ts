import { Resource, Service, State } from "../../context";
import { ErrorHandlerService } from "../../context/error-handler-service";
import { FixedTimeResource } from "../time/fixed-time-resource";
import { TimeState } from "../time/time-state";
import type { Mut } from "../../runtime/system";

/** 分层时间轮的构建期配置。 */
export interface TimerConfigOptions {
    readonly slotCount?: number;
    readonly maxTaskPoolSize?: number;
    readonly debug?: boolean;
}

/** 构建期提供、运行期间不替换的 Timer 配置。 */
export class TimerConfigResource extends Resource {
    readonly slotCount: number;
    readonly slotMask: number;
    readonly maxTaskPoolSize: number;
    readonly debug: boolean;

    constructor(options: Readonly<TimerConfigOptions> = {}) {
        super();
        const slotCount = options.slotCount ?? 64;
        const maxTaskPoolSize = options.maxTaskPoolSize ?? 4096;
        if (!Number.isSafeInteger(slotCount) || slotCount < 2 || (slotCount & (slotCount - 1)) !== 0) {
            throw new RangeError("Timer slotCount must be a power-of-two safe integer greater than one");
        }
        if (slotCount > 0x40000000) {
            throw new RangeError("Timer slotCount exceeds the supported bitwise range");
        }
        if (!Number.isSafeInteger(maxTaskPoolSize) || maxTaskPoolSize < 0) {
            throw new RangeError("Timer maxTaskPoolSize must be a non-negative safe integer");
        }
        this.slotCount = slotCount;
        this.slotMask = slotCount - 1;
        this.maxTaskPoolSize = maxTaskPoolSize;
        this.debug = options.debug ?? false;
    }
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
    readonly ready: InnerTask[] = [];
    readonly readyUsed: number = 0;
}

/** @internal 当前 World 的定时任务包装对象池；不属于可恢复模拟状态。 */
export class TimerPoolService extends Service {
    @Resource.inject(TimerConfigResource) private readonly _config!: TimerConfigResource;
    private readonly _tasks: InnerTask[] = [];

    acquire(): InnerTask {
        const task = this._tasks.pop()
            ?? {
                taskObject: undefined!,
                targetTick: 0,
                createTime: 0,
                expectedTime: 0,
            };
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
        if (this._tasks.length < this._config.maxTaskPoolSize) this._tasks.push(task);
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
    @Resource.inject(TimerConfigResource) private readonly _config!: TimerConfigResource;
    @State.inject(TimeState) private readonly _time!: TimeState;
    @State.inject(TimerState) private readonly _state!: Mut<TimerState>;

    /** 根据当前 TimeState 初始化时间轮。 */
    init() {
        this._state.globalTick = this._time.tick;
        this.createNewLevel(); // 创建第 0 层
        if (this._config.debug) {
            console.log(`[Timer] 初始化，TICK_SEC=${this._fixed.deltaSeconds}, SLOT_COUNT=${this._config.slotCount}`);
        }
    }

    /**
     * 延迟提交一次任务。
     *
     * 延迟时间向上取整到固定 Tick，且最少等待一个 Tick；当前不提供取消接口。
     */
    once(delaySec: number, task: ITimerTask): void {
        if (!Number.isFinite(delaySec) || delaySec < 0) {
            throw new RangeError("delaySec must be a non-negative finite number");
        }
        if (!task || typeof task.submit !== "function") {
            throw new TypeError("Timer task must provide submit()");
        }
        let ticks = Math.ceil(delaySec / this._fixed.deltaSeconds);
        if (ticks < 1) ticks = 1;
        if (!Number.isSafeInteger(ticks)) throw new RangeError("Timer delay exceeds safe Tick range");
        const baseTick = Math.max(this._time.tick, this._state.globalTick);
        if (!Number.isSafeInteger(baseTick) || baseTick < 0 || baseTick + ticks > Number.MAX_SAFE_INTEGER) {
            throw new RangeError("Timer target Tick exceeds the safe integer range");
        }

        const wrapper = this._pool.acquire();
        try {
            wrapper.taskObject = task;
            wrapper.targetTick = baseTick + ticks;
            wrapper.createTime = this._time.elapsed;
            wrapper.expectedTime = this._time.elapsed + ticks * this._fixed.deltaSeconds;

            if (this._config.debug) {
                console.log(
                    `[Timer] 添加任务: 延迟=${delaySec}s -> 折算ticks=${ticks}, ` +
                    `目标绝对tick=${wrapper.targetTick}, 预期触发时间=${wrapper.expectedTime.toFixed(3)}s`
                );
            }

            this.addTaskByTargetTick(wrapper);
        } catch (error) {
            this._pool.recycle(wrapper);
            throw error;
        }
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
                if (this._config.debug) {
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

        let levelIndex = 0;
        for (;;) {
            if (levelIndex >= this._state.levels.length) this.createNewLevel();
            const level = this._state.levels[levelIndex];
            if (remaining < level.totalTicksPerRound) break;
            levelIndex++;
        }

        const level = this._state.levels[levelIndex];
        // ✅ 修正点：槽位 = (当前指针 + 偏移) 再取模
        const delta = Math.floor(remaining / level.tickPerSlot);
        const slot = (level.currentSlot + delta) & this._config.slotMask;
        level.slots[slot].push(task);
    }

    private createNewLevel(): void {
        const newLevelIndex = this._state.levels.length;
        const tickPerSlot = Math.pow(this._config.slotCount, newLevelIndex);
        const totalTicksPerRound = tickPerSlot * this._config.slotCount;

        const level: TimerLevel = {
            slots: Array.from({ length: this._config.slotCount }, () => []),
            currentSlot: 0,
            tickPerSlot,
            totalTicksPerRound,
        };
        this._state.levels.push(level);

        if (this._config.debug) {
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
            for (let slot = 0; slot < slots.length; slot++) {
                const bucket = slots[slot];
                for (let i = 0; i < bucket.length; i++) this._pool.recycle(bucket[i]);
                bucket.length = 0;
            }
        }
        for (let i = 0; i < this._state.readyUsed; i++) {
            this._pool.recycle(this._state.ready[i]);
            this._state.ready[i] = undefined!;
        }
        this._state.levels.length = 0;
        this._state.ready.length = 0;
        this._state.readyUsed = 0;
        this._state.globalTick = 0;
    }
}
