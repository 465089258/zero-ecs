import type { Module } from "../../runtime/module";
import type { GameBuilder } from "../../runtime/game-builder";
import { GameSystemSet } from "../../runtime/stage";
import { EventPoolService, EventService, EventState } from "./event-service";
import { flushEventsSystem } from "./systems";

/** 注册事件服务及 Update.post 分发系统。 */
export class EventModule implements Module {
    /** 向 GameBuilder 安装事件模块。 */
    build(builder: GameBuilder): void {
        builder.addState(EventState);
        builder.addService(EventPoolService);
        builder.addService(EventService);
        builder.addSystem(flushEventsSystem, {
            inSet: GameSystemSet.Events,
            afterIfPresent: GameSystemSet.Structure,
        });
    }
}
