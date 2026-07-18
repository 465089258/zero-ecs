import type { Module } from "../../runtime/module";
import type { EcsBuilder } from "../../runtime/ecs-builder";
import { EventPoolService, EventService, EventState } from "./event-service";
import { flushEventsSystem } from "./systems";

/** 注册事件服务及内部 Post 分发系统。 */
export class EventModule implements Module {
    /** 向 EcsBuilder 安装事件模块。 */
    build(builder: EcsBuilder): void {
        builder.addState(EventState);
        builder.addService(EventPoolService);
        builder.addService(EventService);
        builder.addSystem(flushEventsSystem);
    }
}
