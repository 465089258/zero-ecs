import type { Module } from "../../runtime/module";
import type { EcsBuilder } from "../../runtime/ecs-builder";
import { InternalPost } from "../../schedule/internal-stage";
import { EventService } from "./event-service";
import { flushEventsSystem } from "./systems";

export class EventModule implements Module {
    build(builder: EcsBuilder): void {
        builder.addService(EventService);
        builder.addSystem(InternalPost.event, flushEventsSystem, [EventService]);
    }
}
