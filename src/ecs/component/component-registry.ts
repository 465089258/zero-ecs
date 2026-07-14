import { State, Service } from "../../context/types";
import { Types } from "../../storage/typed-array";
import {
    type ComponentId,
    type ComponentMeta,
    type ComponentType,
} from "./component";
import { Mask } from "./mask";

/** @internal Mutable registry storage; use ComponentService from public code. */
export class ComponentRegistryState extends State {
    readonly metas: ComponentMeta[] = [];
    readonly byType = new WeakMap<ComponentType, ComponentMeta>();
}

/** The only component registration and metadata lookup entry point. */
export class ComponentService extends Service {
    @State.inject(ComponentRegistryState)
    private readonly _state!: ComponentRegistryState;

    /** Define a component in this ECS instance, or return its cached metadata. */
    def<T extends object>(type: ComponentType<T>): ComponentMeta<T> {
        const cached = this._state.byType.get(type);
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

        const id = this._state.metas.length as ComponentId;
        const meta = Object.freeze({
            id,
            name: type.name,
            mask: Mask.fromBit(id),
            type,
            layout: Object.freeze(fields),
        }) as ComponentMeta<T>;
        this._state.metas.push(meta);
        this._state.byType.set(type, meta);
        return meta;
    }

    /** Look up a component type without registering it. */
    get<T extends object>(type: ComponentType<T>): ComponentMeta<T> | undefined {
        return this._state.byType.get(type) as ComponentMeta<T> | undefined;
    }

    /** Low-level lookup for world-local IDs held by storage internals. */
    getById(id: ComponentId): ComponentMeta | undefined {
        return this._state.metas[id];
    }
}
