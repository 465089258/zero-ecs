import { Entity } from "../../ecs/entity/entity";
import { EventArgs } from "./event-service";

export class EntityDespawnEvent extends EventArgs {
    entity!: Entity;
    set(entity: Entity) {
        this.entity = entity;
        return this;
    }
}
