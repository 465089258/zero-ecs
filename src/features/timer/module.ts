import type { Module } from "../../runtime/module";
import type { EcsBuilder } from "../../runtime/ecs-builder";
import { Update } from "../../schedule/stage";
import { advanceTimersSystem } from "./systems";
import { TimerService } from "./timer-service";

/** 注册分层时间轮服务及推进系统；必须与 TimeModule 一同使用。 */
export class TimerModule implements Module {
    /** 向 EcsBuilder 安装定时器模块。 */
    build(builder: EcsBuilder): void {
        builder.addService(TimerService);
        builder.addSystem(Update.fixed, advanceTimersSystem, [TimerService]);
    }
}
