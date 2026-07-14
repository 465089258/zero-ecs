import { Service } from "../../context/types";
import { Command } from "../../ecs/command/command";
import { CommandService } from "../../ecs/command/command-service";
import type { Entity } from "../../ecs/entity/entity";
import { EntityDespawnEvent } from "./entity-events";
import { EventService } from "./event-service";

/** Entity despawn command with event notification supplied by EventFeature. */
export class DespawnEntityCommand extends Command {
    @Service.inject(CommandService) private readonly _commands!: CommandService;
    @Service.inject(EventService) private readonly _events!: EventService;
    entity!: Entity;

    set(entity: Entity): this {
        this.assertMutable();
        this.entity = entity;
        return this;
    }

    execute(): void {
        this._events.event(EntityDespawnEvent).set(this.entity).post();
        this._commands.entity(this.entity).despawn().submit();
    }

    protected clear(): void { this.entity = 0 as Entity; }
}
