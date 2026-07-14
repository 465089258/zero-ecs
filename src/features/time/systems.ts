import type { Mut } from "../../schedule/system";
import { FixedTimeResource } from "./fixed-time-resource";
import { TimeState } from "./time-state";

/** 在 Update.first 阶段推进一次固定模拟时间。 */
export function advanceFixedTimeSystem(fixed: Readonly<FixedTimeResource>, time: Mut<TimeState>): void {
    time.delta = fixed.deltaSeconds;
    time.elapsed += fixed.deltaSeconds;
    time.tick++;
}
