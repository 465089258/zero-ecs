import { TimerService } from "./timer-service";

export function advanceTimersSystem(timer: TimerService): void {
    timer.advance();
}
