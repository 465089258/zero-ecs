import type { Module } from "../../runtime/module";
import type { GameBuilder } from "../../runtime/game-builder";
import { GameSystemSet } from "../../runtime/stage";
import { advanceTimersSystem, dispatchTimerCallbacksSystem } from "./systems";
import { TimerPoolService, TimerService, TimerState } from "./timer-service";

/** 注册分层时间轮服务及推进系统；必须与 TimeModule 一同使用。 */
export class TimerModule implements Module {
    /** 向 GameBuilder 安装定时器模块。 */
    build(builder: GameBuilder): void {
        builder.addState(TimerState);
        builder.addService(TimerPoolService);
        builder.addService(TimerService);
        builder.addSystem(advanceTimersSystem, { inSet: GameSystemSet.TimerAdvance });
        builder.addSystem(dispatchTimerCallbacksSystem, {
            inSet: GameSystemSet.TimerCallbacks,
            before: [GameSystemSet.Commands, GameSystemSet.Structure, GameSystemSet.Events],
        });
    }
}
