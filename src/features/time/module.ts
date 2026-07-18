import type { Module } from "../../runtime/module";
import type { EcsBuilder } from "../../runtime/ecs-builder";
import { FixedTimeResource } from "./fixed-time-resource";
import { advanceFixedTimeSystem } from "./systems";
import { TimeState } from "./time-state";

/** 注册固定时间 Resource、State 与推进系统。 */
export class TimeModule implements Module {
    /** 使用指定固定步长配置创建时间模块。 */
    constructor(readonly fixed = new FixedTimeResource()) {}

    /** 向 EcsBuilder 安装时间模块。 */
    build(builder: EcsBuilder): void {
        builder.addResource(FixedTimeResource, this.fixed);
        builder.addState(TimeState);
        builder.addSystem(advanceFixedTimeSystem);
    }
}
