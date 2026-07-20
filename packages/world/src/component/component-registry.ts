import { Types } from "../storage/typed-array";
import {
    type ComponentId,
    type ComponentDefinition,
    type ComponentMeta,
    type ComponentType,
} from "./component";
import { Mask } from "./mask";

/** @internal World 内核持有的组件注册表。 */
export class ComponentRegistry {
    private readonly _metas: ComponentMeta[] = [];
    private readonly _byType = new WeakMap<ComponentType, ComponentMeta>();

    /**
     * 在当前 World 中定义组件；已定义时直接返回原定义。
     *
     * 组件字段必须是从 `0` 开始连续递增的数字键。
     */
    def<T extends object>(type: ComponentType<T>): ComponentDefinition<T> {
        return this.defMeta(type);
    }

    /** 查询已定义的组件；该操作不会触发注册。 */
    get<T extends object>(type: ComponentType<T>): ComponentDefinition<T> | undefined {
        return this.getMeta(type);
    }

    /** @internal 定义组件并返回当前 World 的存储元数据。 */
    defMeta<T extends object>(type: ComponentType<T>): ComponentMeta<T> {
        const cached = this._byType.get(type);
        if (cached) return cached as ComponentMeta<T>;

        const schema = new type();
        const keys = Object.keys(schema).map(Number).sort((a, b) => a - b);
        if (keys.some((key, index) => !Number.isInteger(key) || key !== index)) {
            throw new Error(`Component ${type.name} fields must be consecutive integers starting at 0`);
        }

        const fields: Types[] = new Array(keys.length);
        for (let i = 0; i < keys.length; i++) {
            const value = (schema as Record<number, unknown>)[keys[i]];
            if (!Number.isInteger(value) || (value as number) < Types.I8 || (value as number) > Types.F32) {
                throw new TypeError(`Component ${type.name} field ${keys[i]} has invalid type ${String(value)}`);
            }
            fields[i] = value as Types;
        }

        const id = this._metas.length as ComponentId;
        const meta = Object.freeze({
            id,
            name: type.name,
            mask: Mask.fromBit(id),
            type,
            layout: Object.freeze(fields),
        }) as ComponentMeta<T>;
        this._metas.push(meta);
        this._byType.set(type, meta);
        return meta;
    }

    /** @internal 查询当前 World 的存储元数据，不触发注册。 */
    getMeta<T extends object>(type: ComponentType<T>): ComponentMeta<T> | undefined {
        return this._byType.get(type) as ComponentMeta<T> | undefined;
    }

    /** @internal 根据当前 World 的组件编号查询存储元数据。 */
    getById(id: ComponentId): ComponentMeta | undefined {
        return this._metas[id];
    }
}
