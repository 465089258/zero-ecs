import { type EcsBuilder, type Module } from "zero-ecs-lib";
import { spawnSystem } from "../zombie/systems";
import { shooterFireSystem } from "./systems";

export class ShooterModule implements Module {
    build(builder: EcsBuilder): void {
        builder.addSystem(shooterFireSystem, { after: spawnSystem });
    }
}
