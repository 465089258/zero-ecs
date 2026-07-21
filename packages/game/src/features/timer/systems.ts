import { ErrorHandlerService } from "../../context/error-handler-service";
import { defSystem, type Mut, Write } from "../../runtime/system";
import { Update } from "../../runtime/stage";
import { TimeState } from "../time/time-state";
import {
    type InnerTask,
    TimerConfigResource,
    type TimerLevel,
    TimerPoolService,
    TimerState,
} from "./timer-service";

/** 在固定模拟阶段推进时间轮，只产出到期待执行队列。 */
export const advanceTimersSystem = defSystem(
    Update.fixed,
    advanceTimers,
    [TimeState, Write(TimerState), TimerConfigResource],
);

/** 在 Post 阶段提交到期任务；具体相对顺序由 Module 依赖图决定。 */
export const dispatchTimerCallbacksSystem = defSystem(
    Update.post,
    dispatchTimerCallbacks,
    [TimeState, Write(TimerState), TimerConfigResource, TimerPoolService, ErrorHandlerService],
);

function advanceTimers(
    time: Readonly<TimeState>,
    timer: Mut<TimerState>,
    config: Readonly<TimerConfigResource>,
): void {
    while (timer.globalTick < time.tick) {
        timer.globalTick++;
        tick(timer, config);
    }
}

function tick(timer: Mut<TimerState>, config: Readonly<TimerConfigResource>): void {
    const level0 = timer.levels[0];
    level0.currentSlot = (level0.currentSlot + 1) & config.slotMask;
    processSlot(level0, 0, timer, config);
    if (level0.currentSlot === 0) advanceLevel(1, timer, config);
}

function advanceLevel(
    levelIndex: number,
    timer: Mut<TimerState>,
    config: Readonly<TimerConfigResource>,
): void {
    if (levelIndex >= timer.levels.length) return;
    const level = timer.levels[levelIndex];
    level.currentSlot = (level.currentSlot + 1) & config.slotMask;
    processSlot(level, levelIndex, timer, config);
    if (level.currentSlot === 0) advanceLevel(levelIndex + 1, timer, config);
}

function processSlot(
    level: TimerLevel,
    levelIndex: number,
    timer: Mut<TimerState>,
    config: Readonly<TimerConfigResource>,
): void {
    const bucket = level.slots[level.currentSlot];
    const count = bucket.length;
    for (let i = 0; i < count; i++) {
        const task = bucket[i];
        if (levelIndex === 0) enqueueReady(task, timer);
        else addTaskByTargetTick(task, timer, config);
    }
    bucket.length = 0;
}

function addTaskByTargetTick(
    task: InnerTask,
    timer: Mut<TimerState>,
    config: Readonly<TimerConfigResource>,
): void {
    const remaining = task.targetTick - timer.globalTick;
    if (remaining <= 0) {
        enqueueReady(task, timer);
        return;
    }
    let levelIndex = 0;
    for (;;) {
        if (levelIndex >= timer.levels.length) createNewLevel(timer, config);
        if (remaining < timer.levels[levelIndex].totalTicksPerRound) break;
        levelIndex++;
    }
    const level = timer.levels[levelIndex];
    const delta = Math.floor(remaining / level.tickPerSlot);
    const slot = (level.currentSlot + delta) & config.slotMask;
    level.slots[slot].push(task);
}

function enqueueReady(task: InnerTask, timer: Mut<TimerState>): void {
    const index = timer.readyUsed++;
    if (index < timer.ready.length) timer.ready[index] = task;
    else timer.ready.push(task);
}

function dispatchTimerCallbacks(
    time: Readonly<TimeState>,
    timer: Mut<TimerState>,
    config: Readonly<TimerConfigResource>,
    pool: TimerPoolService,
    errors: ErrorHandlerService,
): void {
    const used = timer.readyUsed;
    timer.readyUsed = 0;
    let firstError: unknown;
    for (let i = 0; i < used; i++) {
        const task = timer.ready[i];
        try {
            task.taskObject.submit();
            if (config.debug) {
                const difference = time.elapsed - task.expectedTime;
                console.log(
                    `[Timer] 触发任务: 实际=${time.elapsed.toFixed(3)}s, ` +
                    `预期=${task.expectedTime.toFixed(3)}s, ` +
                    `误差=${difference >= 0 ? "+" : ""}${difference.toFixed(6)}s`,
                );
            }
        } catch (error) {
            try { errors.report(error, "timer", task.taskObject); }
            catch (handlerError) { firstError ??= handlerError; }
        } finally {
            pool.recycle(task);
            timer.ready[i] = undefined!;
        }
    }
    if (firstError !== undefined) throw firstError;
}

function createNewLevel(timer: Mut<TimerState>, config: Readonly<TimerConfigResource>): void {
    const index = timer.levels.length;
    const tickPerSlot = Math.pow(config.slotCount, index);
    timer.levels.push({
        slots: Array.from({ length: config.slotCount }, () => []),
        currentSlot: 0,
        tickPerSlot,
        totalTicksPerRound: tickPerSlot * config.slotCount,
    });
}
