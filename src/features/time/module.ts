import type { Module } from "../../runtime/module";
import type { EcsBuilder } from "../../runtime/ecs-builder";
import { Write } from "../../schedule/system";
import { Update } from "../../schedule/stage";
import { FixedTimeResource } from "./fixed-time-resource";
import { advanceFixedTimeSystem } from "./systems";
import { TimeState } from "./time-state";

export class TimeModule implements Module {
    constructor(readonly fixed = new FixedTimeResource()) {}

    build(builder: EcsBuilder): void {
        builder.addResource(FixedTimeResource, this.fixed);
        builder.addState(TimeState);
        builder.addSystem(Update.first, advanceFixedTimeSystem, [FixedTimeResource, Write(TimeState)]);
    }
}
