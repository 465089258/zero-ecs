import { defSystem, type Mut, Write } from "../../runtime/system";
import { Update } from "../../runtime/stage";
import { FixedTimeResource } from "./fixed-time-resource";
import { TimeState } from "./time-state";


export const advanceFixedTimeSystem = defSystem(
    Update.first,
    advanceFixedTime,
    [FixedTimeResource, Write(TimeState)],
);

/** 在 Update.first 阶段推进一次固定模拟时间。 */
function advanceFixedTime(fixed: Readonly<FixedTimeResource>, time: Mut<TimeState>): void {
    time.delta = fixed.deltaSeconds;
    time.elapsed += fixed.deltaSeconds;
    time.tick++;
}
