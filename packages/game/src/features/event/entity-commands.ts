import { Service } from "../../context/service";
import type { Entity } from "@zero-ecs/world";
import { Command } from "../../command/command";
import { Commands } from "../../command/command-service";
import { EntityDespawnEvent } from "./entity-events";
import { EventService } from "./event-service";

/** 先发布销毁通知，再提交实体销毁操作的事件功能命令。 */
export class DespawnEntityCommand extends Command {
    @Service.inject(Commands) private readonly _commands!: Commands;
    @Service.inject(EventService) private readonly _events!: EventService;
    entity!: Entity;

    /** 设置要销毁的实体。 */
    set(entity: Entity): this {
        this.assertMutable();
        this.entity = entity;
        return this;
    }

    /** 发布事件并提交对应 EntityCommand；通常由 Commands 调用。 */
    execute(): void {
        this._events.event(EntityDespawnEvent).set(this.entity).post();
        this._commands.entity(this.entity).despawn().submit();
    }

    protected clear(): void { this.entity = 0 as Entity; }
}
