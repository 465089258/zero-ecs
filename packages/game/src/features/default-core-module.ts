import { CommandModule } from "../command/module";
import type { GameBuilder } from "../runtime/game-builder";
import type { Module } from "../runtime/module";
import { EventModule } from "./event/module";
import { RandomModule } from "./random/module";
import { FixedTimeResource } from "./time/fixed-time-resource";
import { TimeModule } from "./time/module";
import { TimerModule } from "./timer/module";

/**
 * 安装 Game 提供的默认基础设施：Commands、Time、Timer、Event 与 Random。
 * 需要裁剪功能时，应改为按需注册对应的独立 Module。
 */
export class DefaultCoreModule implements Module {
    /** 使用指定固定步长配置默认时间基础设施。 */
    constructor(readonly fixedTime = new FixedTimeResource()) {}

    /** 向 GameBuilder 安装全部默认基础设施 Module。 */
    build(builder: GameBuilder): void {
        builder.addModule(new CommandModule());
        builder.addModule(new TimeModule(this.fixedTime));
        builder.addModule(new TimerModule());
        builder.addModule(new EventModule());
        builder.addModule(new RandomModule());
    }
}
