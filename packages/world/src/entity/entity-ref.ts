import type {
    ComponentFieldValue,
    ComponentFields,
    ComponentType,
} from "../component/component";
import type { WorldView } from "../world";
import type { Entity } from "./entity";

/**
 * 绑定一个 World-local Entity 的低频只读便利视图。
 *
 * EntityRef 只保存 WorldView 与带版本实体句柄，不缓存 Archetype、Chunk、行或组件列。
 * 它不会钉住实体；实体销毁后，既有引用的 {@link valid} 会变为 `false`。
 */
export class EntityRef {
    constructor(
        private readonly _world: WorldView,
        readonly entity: Entity,
    ) {}

    /** 当前实体句柄在所属 World 中是否仍然有效。 */
    get valid(): boolean { return this._world.valid(this.entity); }

    /** 判断当前实体是否具有指定组件。 */
    has<T extends object>(type: ComponentType<T>): boolean {
        return this._world.has(this.entity, type);
    }

    /** 读取当前实体的组件字段；实体、组件或字段不存在时返回 `null`。 */
    get<T extends object, Field extends ComponentFields<T>>(
        type: ComponentType<T>,
        field: Field,
    ): ComponentFieldValue<T, Field> | null {
        return this._world.get(this.entity, type, field);
    }

    /** 判断两个引用是否绑定同一个 World 中的同一个带版本实体句柄。 */
    equals(other: EntityRef): boolean {
        return this._world === other._world && this.entity === other.entity;
    }
}
