import { TimerService } from "./timer-service";

/** 在固定更新阶段将时间轮推进到当前模拟 Tick。 */
export function advanceTimersSystem(timer: TimerService): void {
    timer.advance();
}
