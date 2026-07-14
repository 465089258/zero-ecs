import type { EcsBuilder } from "./ecs-builder";
import type { Ecs } from "./ecs";

/** A composition unit with optional hooks for resources owned outside ECS containers. */
export interface Module {
    build(builder: EcsBuilder): void;
    init?(ecs: Ecs): void;
    start?(ecs: Ecs): void;
    stop?(ecs: Ecs): void;
    dispose?(ecs: Ecs): void;
}
