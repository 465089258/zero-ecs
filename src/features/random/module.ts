import type { Module } from "../../runtime/module";
import type { EcsBuilder } from "../../runtime/ecs-builder";
import { RandomService } from "./random-service";

export class RandomModule implements Module {
    build(builder: EcsBuilder): void {
        builder.addService(RandomService);
    }
}
