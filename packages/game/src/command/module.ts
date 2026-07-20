import type { Module } from "../runtime/module";
import type { GameBuilder } from "../runtime/game-builder";
import { GameSystemSet } from "../runtime/stage";
import { Commands } from "./command-service";
import { applyEntityCommandsSystem, flushCommandsSystem } from "./systems";

/** 注册命令队列、实体迁移及其 Update.post 提交系统。 */
export class CommandModule implements Module {
    /** 向 GameBuilder 安装命令模块。 */
    build(builder: GameBuilder): void {
        builder.addService(Commands);
        builder.addSystem(flushCommandsSystem, { inSet: GameSystemSet.Commands });
        builder.addSystem(applyEntityCommandsSystem, {
            inSet: GameSystemSet.Structure,
            after: GameSystemSet.Commands,
        });
    }
}
