import type { Module } from "../../runtime/module";
import type { EcsBuilder } from "../../runtime/ecs-builder";
import { RandomService, RandomState } from "./random-service";

/** 注册确定性随机服务。 */
export class RandomModule implements Module {
    /** 向 EcsBuilder 安装随机模块。 */
    build(builder: EcsBuilder): void {
        builder.addState(RandomState);
        builder.addService(RandomService);
    }
}
