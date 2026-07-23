import type { Module } from "../runtime/module";
import type { GameBuilder } from "../runtime/game-builder";
import { GameSystemSet } from "../runtime/stage";
import { Migrations } from "../migration/migration-service";
import { applyMigrationsSystem } from "../migration/systems";
import { Commands } from "./command-service";
import { flushCommandsSystem } from "./systems";

/** 注册命令队列、实体迁移及其 Update.post 提交系统。 */
export class CommandModule implements Module {
    /** 向 GameBuilder 安装命令模块。 */
    build(builder: GameBuilder): void {
        builder.addService(Migrations);
        builder.addService(Commands);
        builder.addSystem(flushCommandsSystem, { inSet: GameSystemSet.Commands });
        builder.addSystem(applyMigrationsSystem, {
            inSet: GameSystemSet.Structure,
            after: GameSystemSet.Commands,
        });
    }
}
