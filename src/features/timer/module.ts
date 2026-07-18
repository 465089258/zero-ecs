import type { Module } from "../../runtime/module";
import type { EcsBuilder } from "../../runtime/ecs-builder";
import { advanceTimersSystem } from "./systems";
import { TimerPoolService, TimerService, TimerState } from "./timer-service";

/** 注册分层时间轮服务及推进系统；必须与 TimeModule 一同使用。 */
export class TimerModule implements Module {
    /** 向 EcsBuilder 安装定时器模块。 */
    build(builder: EcsBuilder): void {
        builder.addState(TimerState);
        builder.addService(TimerPoolService);
        builder.addService(TimerService);
        builder.addSystem(advanceTimersSystem);
    }
}
