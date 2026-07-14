import { Service } from "../../context/types";
import { ArchetypeService } from "../archetype/archetype-service";
import {
    type ComponentFields,
    type ComponentId,
    type ComponentMeta,
    type ComponentType,
} from "../component/component";
import { ComponentService } from "../component/component-registry";
import { Mask } from "../component/mask";
import { EntityService, type Entity } from "../entity/entity-service";
import { EntityMigrationService } from "../migration/entity-migration-service";
import { Command } from "./command";
import { ENTITY_INSTRUCTION_SIZE, EntityInstruction } from "./entity-instruction";

const enum EntityCommandFlags {
    Despawn = 1 << 2,
    Structural = 1 << 3,
}

const enum AddInstructionFlags {
    CreatedLocalInstance = 1 << 0,
}

export interface EntityMutator {
    readonly entity: Entity;
    has<T extends object>(type: ComponentType<T>): boolean;
    get<T extends object, Field extends ComponentFields<T>>(
        type: ComponentType<T>,
        field: Field,
    ): number | null;
    add<T extends object>(type: ComponentType<T>): this;
    remove<T extends object>(type: ComponentType<T>): this;
    set<T extends object, Field extends ComponentFields<T>>(
        type: ComponentType<T>,
        field: Field,
        value: number,
    ): this;
}

/** A pooled local transaction for one entity. */
export class EntityCommand extends Command implements EntityMutator {
    @Service.inject(ArchetypeService) private readonly _archetypes!: ArchetypeService;
    @Service.inject(ComponentService) private readonly _components!: ComponentService;
    @Service.inject(EntityService) private readonly _entities!: EntityService;
    @Service.inject(EntityMigrationService) private readonly _migration!: EntityMigrationService;

    private _entity = 0 as Entity;
    private readonly _targetMask = Mask.empty();
    private readonly _types: ComponentMeta[] = [];
    private readonly _instructions: number[] = [];
    private _used = 0;

    get entity(): Entity { return this._entity; }

    /** @internal CommandService binding hook. */
    bind(entity: Entity): void {
        this.assertMutable();
        if (!this._entities.valid(entity)) throw new RangeError(`Invalid entity ${entity}`);
        this._entity = entity;
        this._used = 0;
        this._types.length = 0;
        this._targetMask.toZero();
        const archetype = this._archetypes.getAtIdx(this._entities.getArchIdx(entity));
        if (!archetype) return;
        archetype.mask.copyTo(this._targetMask);
        for (let i = 0; i < archetype.types.length; i++) this._types.push(archetype.types[i]);
    }

    has<T extends object>(type: ComponentType<T>): boolean {
        this.assertEntityMutable();
        const component = this._components.getMeta(type);
        return component !== undefined && this._targetMask.has(component.mask);
    }

    get<T extends object, Field extends ComponentFields<T>>(
        type: ComponentType<T>,
        field: Field,
    ): number | null {
        this.assertEntityMutable();
        const component = this._components.getMeta(type);
        if (!component || !this._targetMask.has(component.mask)) return null;
        this.validateField(component, field);
        for (let i = this._used - ENTITY_INSTRUCTION_SIZE; i >= 0; i -= ENTITY_INSTRUCTION_SIZE) {
            if (this._instructions[i + 1] !== component.id) continue;
            const operation = this._instructions[i];
            if (operation === EntityInstruction.Set && this._instructions[i + 2] === field) {
                return this._instructions[i + 3];
            }
            if (operation === EntityInstruction.Add) {
                if ((this._instructions[i + 2] & AddInstructionFlags.CreatedLocalInstance) !== 0) return 0;
                continue;
            }
            if (operation === EntityInstruction.Remove) return null;
        }
        return this._entities.get(this._entity, type, field);
    }

    add<T extends object>(type: ComponentType<T>): this {
        this.assertEntityMutable();
        const component = this._components.defMeta(type);
        const created = !this._targetMask.has(component.mask);
        if (created) {
            this._targetMask.orInto(component.mask);
            this._types.push(component);
        }
        this._flags |= EntityCommandFlags.Structural;
        this.write(
            EntityInstruction.Add,
            component.id,
            created ? AddInstructionFlags.CreatedLocalInstance : 0,
            0,
        );
        return this;
    }

    remove<T extends object>(type: ComponentType<T>): this {
        this.assertEntityMutable();
        const component = this._components.getMeta(type);
        if (!component) return this;
        if (this._targetMask.has(component.mask)) {
            this._targetMask.andNotInto(component.mask);
            for (let i = 0; i < this._types.length; i++) {
                if (this._types[i].id !== component.id) continue;
                this._types[i] = this._types[this._types.length - 1];
                this._types.length--;
                break;
            }
        }
        this._flags |= EntityCommandFlags.Structural;
        this.write(EntityInstruction.Remove, component.id, 0, 0);
        return this;
    }

    set<T extends object, Field extends ComponentFields<T>>(
        type: ComponentType<T>,
        field: Field,
        value: number,
    ): this {
        this.assertEntityMutable();
        const component = this._components.defMeta(type);
        this.validateField(component, field);
        if (!this._targetMask.has(component.mask)) this.add(type);
        this.write(EntityInstruction.Set, component.id, field, value);
        return this;
    }

    despawn(): this {
        this.assertEntityMutable();
        this._flags |= EntityCommandFlags.Despawn;
        this._used = 0;
        return this;
    }

    execute(): void {
        if (!this._entities.valid(this._entity)) {
            throw new RangeError(`Invalid entity ${this._entity}`);
        }
        if ((this._flags & EntityCommandFlags.Despawn) !== 0) {
            this._migration.cancel(this._entity);
            this._entities.despawn(this._entity);
            return;
        }
        if (this._used === 0) return;
        if (!this._hasStructuralChanges() && !this._migration.has(this._entity)) {
            this.writeFieldsDirect();
            return;
        }
        this._migration.record(this._entity, this._instructions, this._used);
    }

    /** @internal Used by the migration and direct-write paths. */
    _hasStructuralChanges(): boolean {
        return (this._flags & EntityCommandFlags.Structural) !== 0;
    }

    protected clear(): void {
        this._entity = 0 as Entity;
        this._used = 0;
        this._types.length = 0;
        this._targetMask.toZero();
    }

    private assertEntityMutable(): void {
        this.assertMutable();
        if ((this._flags & EntityCommandFlags.Despawn) !== 0) {
            throw new Error(`EntityCommand for ${this._entity} is already marked for despawn`);
        }
    }

    private validateField(component: ComponentMeta, field: number): void {
        if (!Number.isInteger(field) || field < 0 || field >= component.layout.length) {
            throw new RangeError(
                `Component ${component.name} field ${field} is outside 0..${component.layout.length - 1}`,
            );
        }
    }

    private write(operation: EntityInstruction, component: ComponentId, field: number, value: number): void {
        const values = this._instructions;
        let index = this._used;
        if (index < values.length) values[index] = operation;
        else values.push(operation);
        index++;
        if (index < values.length) values[index] = component;
        else values.push(component);
        index++;
        if (index < values.length) values[index] = field;
        else values.push(field);
        index++;
        if (index < values.length) values[index] = value;
        else values.push(value);
        this._used += ENTITY_INSTRUCTION_SIZE;
    }

    private writeFieldsDirect(): void {
        const values = this._instructions;
        for (let i = 0; i < this._used; i += ENTITY_INSTRUCTION_SIZE) {
            if (values[i] !== EntityInstruction.Set) {
                throw new Error("EntityCommand direct-write path received a structural instruction");
            }
            const componentId = values[i + 1] as ComponentId;
            const field = values[i + 2];
            if (!this._entities.canSetComponentFieldById(this._entity, componentId, field)) {
                const component = this._components.getById(componentId as ComponentId);
                throw new Error(
                    `Cannot write ${component?.name ?? componentId}.${field} on entity ${this._entity}`,
                );
            }
        }
        for (let i = 0; i < this._used; i += ENTITY_INSTRUCTION_SIZE) {
            this._entities.setComponentFieldById(
                this._entity,
                values[i + 1] as ComponentId,
                values[i + 2],
                values[i + 3],
            );
        }
    }
}
