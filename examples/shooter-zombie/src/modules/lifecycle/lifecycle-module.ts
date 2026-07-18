import { type EcsBuilder, type Module } from "zero-ecs-lib";
import { levelUpSystem } from "../progression/systems";
import { restartSystem, startupGameSystem, statisticsSystem } from "./systems";

export class LifecycleModule implements Module {
    build(builder: EcsBuilder): void {
        builder.addSystem(startupGameSystem);

        builder.addSystem(restartSystem);

        builder.addSystem(statisticsSystem, { after: levelUpSystem });
    }
}
