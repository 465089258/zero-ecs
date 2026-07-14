import type { Module } from "../../runtime/module";
import type { EcsBuilder } from "../../runtime/ecs-builder";
import { InternalPost } from "../../schedule/internal-stage";
import { EventService } from "./event-service";
import { flushEventsSystem } from "./systems";

/** 注册事件服务及内部 Post 分发系统。 */
export class EventModule implements Module {
    /** 向 EcsBuilder 安装事件模块。 */
    build(builder: EcsBuilder): void {
        builder.addService(EventService);
        builder.addSystem(InternalPost.event, flushEventsSystem, [EventService]);
    }
}
