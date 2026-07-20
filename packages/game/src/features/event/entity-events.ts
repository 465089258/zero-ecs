import type { Entity } from "@zero-ecs/world";
import { EventArgs } from "./event-service";

/** 实体销毁通知事件。 */
export class EntityDespawnEvent extends EventArgs {
    /** 被销毁的实体。 */
    entity!: Entity;
    /** 设置被销毁实体并返回当前事件，便于链式发布。 */
    set(entity: Entity) {
        this.assertMutable();
        this.entity = entity;
        return this;
    }

    /** 回收前清空实体句柄；通常由 EventService 调用。 */
    clear(): void { this.entity = 0 as Entity; }
}
