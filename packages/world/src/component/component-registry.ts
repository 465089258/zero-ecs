import { Types } from "../storage/typed-array";
import {
    type ComponentId,
    type ComponentMeta,
    type ComponentType,
} from "./component";
import { Mask } from "./mask";
import {
    storageOfQueryProjection,
    type QueryDataType,
} from "../query/query-data";

/** @internal World 内核持有的组件注册表。 */
export class ComponentRegistry {
    private readonly _metas: ComponentMeta[] = [];
    private readonly _byType = new WeakMap<ComponentType, ComponentMeta>();

    /** @internal 定义 Query 数据并返回实际存储组件元数据。 */
    defQueryMeta<T extends object>(type: QueryDataType<T>): ComponentMeta<T> {
        if (typeof type === "function") return this.defMeta(type);
        return this.defMeta(storageOfQueryProjection(type));
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
            if (!Number.isInteger(value) || (value as number) < Types.I8 || (value as number) > Types.Entity) {
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
