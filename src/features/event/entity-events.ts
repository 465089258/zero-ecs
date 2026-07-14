import { Entity } from "../../ecs/entity/entity";
import { EventArgs } from "./event-service";

export class EntityDespawnEvent extends EventArgs {
    entity!: Entity;
    set(entity: Entity) {
        this.assertMutable();
        this.entity = entity;
        return this;
    }

    clear(): void { this.entity = 0 as Entity; }
}
