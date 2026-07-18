import { ErrorHandlerService } from "../../context/error-handler-service";
import { defSystem, type Mut, Write } from "../../schedule/system";
import { Update } from "../../schedule/stage";
import { TimeState } from "../time/time-state";
import {
    type InnerTask,
    TimerConfig,
    type TimerLevel,
    TimerPoolService,
    TimerState,
} from "./timer-service";

export const advanceTimersSystem = defSystem(
    Update.fixed,
    advanceTimers,
    [TimeState, Write(TimerState), TimerPoolService, ErrorHandlerService],
);

/** 在固定更新阶段直接推进时间轮状态并提交到期任务。 */
function advanceTimers(
    time: Readonly<TimeState>,
    timer: Mut<TimerState>,
    pool: TimerPoolService,
    errors: ErrorHandlerService,
): void {
    while (timer.globalTick < time.tick) {
        timer.globalTick++;
        tick(timer, time, pool, errors);
    }
}

function tick(timer: Mut<TimerState>, time: Readonly<TimeState>, pool: TimerPoolService, errors: ErrorHandlerService): void {
    const level0 = timer.levels[0];
    level0.currentSlot = (level0.currentSlot + 1) & (TimerConfig.SLOT_COUNT - 1);
    processSlot(level0, 0, timer, time, pool, errors);
    if (level0.currentSlot === 0) advanceLevel(1, timer, time, pool, errors);
}

function advanceLevel(
    levelIndex: number,
    timer: Mut<TimerState>,
    time: Readonly<TimeState>,
    pool: TimerPoolService,
    errors: ErrorHandlerService,
): void {
    if (levelIndex >= timer.levels.length) return;
    const level = timer.levels[levelIndex];
    level.currentSlot = (level.currentSlot + 1) & (TimerConfig.SLOT_COUNT - 1);
    processSlot(level, levelIndex, timer, time, pool, errors);
    if (level.currentSlot === 0) advanceLevel(levelIndex + 1, timer, time, pool, errors);
}

function processSlot(
    level: TimerLevel,
    levelIndex: number,
    timer: Mut<TimerState>,
    time: Readonly<TimeState>,
    pool: TimerPoolService,
    errors: ErrorHandlerService,
): void {
    const bucket = level.slots[level.currentSlot];
    const count = bucket.length;
    for (let i = 0; i < count; i++) {
        const task = bucket[i];
        if (levelIndex === 0) submit(task, pool, time, errors);
        else addTaskByTargetTick(task, timer, time, pool, errors);
    }
    bucket.length = 0;
}

function addTaskByTargetTick(
    task: InnerTask,
    timer: Mut<TimerState>,
    time: Readonly<TimeState>,
    pool: TimerPoolService,
    errors: ErrorHandlerService,
): void {
    const remaining = task.targetTick - timer.globalTick;
    if (remaining <= 0) {
        submit(task, pool, time, errors);
        return;
    }
    let levelIndex = 0;
    while (levelIndex < timer.levels.length) {
        if (remaining < timer.levels[levelIndex].totalTicksPerRound) break;
        levelIndex++;
    }
    while (levelIndex >= timer.levels.length) createNewLevel(timer);
    const level = timer.levels[levelIndex];
    const delta = Math.floor(remaining / level.tickPerSlot);
    const slot = (level.currentSlot + delta) & (TimerConfig.SLOT_COUNT - 1);
    level.slots[slot].push(task);
}

function submit(
    task: InnerTask,
    pool: TimerPoolService,
    time: Readonly<TimeState>,
    errors: ErrorHandlerService,
): void {
    try {
        task.taskObject.submit();
        if (TimerConfig.DEBUG) {
            const difference = time.elapsed - task.expectedTime;
            console.log(
                `[Timer] 触发任务: 实际=${time.elapsed.toFixed(3)}s, ` +
                `预期=${task.expectedTime.toFixed(3)}s, ` +
                `误差=${difference >= 0 ? "+" : ""}${difference.toFixed(6)}s`,
            );
        }
    } catch (error) {
        errors.report(error, "timer", task.taskObject);
    }
    pool.recycle(task);
}

function createNewLevel(timer: Mut<TimerState>): void {
    const index = timer.levels.length;
    const tickPerSlot = Math.pow(TimerConfig.SLOT_COUNT, index);
    timer.levels.push({
        slots: Array.from({ length: TimerConfig.SLOT_COUNT }, () => []),
        currentSlot: 0,
        tickPerSlot,
        totalTicksPerRound: tickPerSlot * TimerConfig.SLOT_COUNT,
    });
}
