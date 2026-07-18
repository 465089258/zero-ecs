import { CommandService, TimeState, Update, type Module, type EcsBuilder, type SystemHandle } from "zero-ecs-lib";
import { GameState } from "../common/game-state";
import { DamageTextQuery } from "./query";
import { damageTextUpdateSystem } from "./update";

export class DamageTextModule implements Module {
    updateId: SystemHandle = 0 as any;
    build(builder: EcsBuilder): void {
        this.updateId = builder.addSystem(Update.fixed, damageTextUpdateSystem, [
            TimeState, GameState, CommandService, DamageTextQuery,
        ]);
    }
}
