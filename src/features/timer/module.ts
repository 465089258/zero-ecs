import type { Module } from "../../runtime/module";
import type { EcsBuilder } from "../../runtime/ecs-builder";
import { Update } from "../../schedule/stage";
import { advanceTimersSystem } from "./systems";
import { TimerService } from "./timer-service";

export class TimerModule implements Module {
    build(builder: EcsBuilder): void {
        builder.addService(TimerService);
        builder.addSystem(Update.fixed, advanceTimersSystem, [TimerService]);
    }
}
