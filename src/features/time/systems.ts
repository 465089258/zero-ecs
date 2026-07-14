import type { Mut } from "../../schedule/system";
import { FixedTimeResource } from "./fixed-time-resource";
import { TimeState } from "./time-state";

export function advanceFixedTimeSystem(fixed: Readonly<FixedTimeResource>, time: Mut<TimeState>): void {
    time.delta = fixed.deltaSeconds;
    time.elapsed += fixed.deltaSeconds;
    time.tick++;
}
