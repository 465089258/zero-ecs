import type { EcsBuilder, Module } from "zero-ecs-lib";
import { SpawnService } from "./spawn-service";

/** 注册供各玩法模块共同使用的实体生成服务。 */
export class SpawnModule implements Module {
    build(builder: EcsBuilder): void {
        builder.addService(SpawnService);
    }
}
