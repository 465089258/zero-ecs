import {
    type ComponentFieldValue,
    type ComponentFields,
    type ComponentType,
    type Entity,
    type EntityAccess,
    World,
} from "@zero-ecs/world";
import {
    type Archetype,
    type ArchetypeRow,
    type ComponentId,
    type ComponentMeta,
    Mask,
} from "@zero-ecs/world/advanced";

const enum EntityInstruction {
    Add = 1,
    Remove = 2,
    Set = 3,
}

const ENTITY_INSTRUCTION_SIZE = 4;

const enum EntityTransactionFlags {
    Despawn = 1 << 0,
    Structural = 1 << 1,
}

const enum EntityTransactionPhase {
    Mutable,
    Sealed,
    Applied,
    Recycled,
}

const enum AddInstructionFlags {
    CreatedLocalInstance = 1 << 0,
}

/** Game 单帧内的局部实体修改接口。 */
export interface EntityMutator {
    readonly entity: Entity;
    has<T extends object>(type: ComponentType<T>): boolean;
    get<T extends object, Field extends ComponentFields<T>>(
        type: ComponentType<T>,
        field: Field,
    ): ComponentFieldValue<T, Field> | null;
    add<T extends object>(type: ComponentType<T>): this;
    remove<T extends object>(type: ComponentType<T>): this;
    set<T extends object, Field extends ComponentFields<T>>(
        type: ComponentType<T>,
        field: Field,
        value: ComponentFieldValue<T, Field>,
    ): this;
}

/** Game 内部可池化、可合并的单实体迁移事务。 */
export class EntityTransaction implements EntityMutator {
    private _entity = 0 as Entity;
    private _phase = EntityTransactionPhase.Recycled;
    private _flags = 0;
    private readonly _targetMask = Mask.empty();
    private readonly _types: ComponentMeta[] = [];
    private readonly _instructions: number[] = [];
    private _used = 0;

    private readonly _resetComponents: ComponentId[] = [];
    private _resetUsed = 0;
    private readonly _writeComponents: ComponentId[] = [];
    private readonly _writeFields: number[] = [];
    private readonly _writeValues: number[] = [];
    private _writeUsed = 0;
    private readonly _access: EntityAccess = {
        archetype: null,
        row: 0 as ArchetypeRow,
    };

    constructor(private readonly world: World) {}

    get entity(): Entity { return this._entity; }

    belongsTo(world: World): boolean { return this.world === world; }

    has<T extends object>(type: ComponentType<T>): boolean {
        this.assertMutable();
        const component = this.world.findComponent(type);
        return component !== undefined && this._targetMask.has(component.mask);
    }

    get<T extends object, Field extends ComponentFields<T>>(
        type: ComponentType<T>,
        field: Field,
    ): ComponentFieldValue<T, Field> | null {
        this.assertMutable();
        const component = this.world.findComponent(type);
        if (!component || !this._targetMask.has(component.mask)) return null;
        this.validateField(component, field);
        for (let i = this._used - ENTITY_INSTRUCTION_SIZE; i >= 0; i -= ENTITY_INSTRUCTION_SIZE) {
            if (this._instructions[i + 1] !== component.id) continue;
            const operation = this._instructions[i];
            if (operation === EntityInstruction.Set && this._instructions[i + 2] === field) {
                return this._instructions[i + 3] as ComponentFieldValue<T, Field>;
            }
            if (operation === EntityInstruction.Add) {
                if ((this._instructions[i + 2] & AddInstructionFlags.CreatedLocalInstance) !== 0) {
                    return 0 as ComponentFieldValue<T, Field>;
                }
                continue;
            }
            if (operation === EntityInstruction.Remove) return null;
        }
        return this.world.get(this._entity, type, field);
    }

    add<T extends object>(type: ComponentType<T>): this {
        this.assertMutable();
        this.recordAdd(this.world.component(type));
        return this;
    }

    remove<T extends object>(type: ComponentType<T>): this {
        this.assertMutable();
        const component = this.world.findComponent(type);
        if (component) this.recordRemove(component);
        return this;
    }

    set<T extends object, Field extends ComponentFields<T>>(
        type: ComponentType<T>,
        field: Field,
        value: ComponentFieldValue<T, Field>,
    ): this {
        this.assertMutable();
        const component = this.world.component(type);
        this.validateField(component, field);
        this.recordSet(component, field, value);
        return this;
    }

    despawn(): this {
        this.assertMutable();
        this.recordDespawn();
        return this;
    }

    reset(entity: Entity): void {
        if (this._phase !== EntityTransactionPhase.Recycled) {
            throw new Error("EntityTransaction cannot be reset before it is recycled");
        }
        if (!this.world.resolve(entity, this._access)) {
            throw new RangeError(`Invalid entity ${entity}`);
        }
        this._entity = entity;
        this._phase = EntityTransactionPhase.Mutable;
        this._flags = 0;
        this._used = 0;
        this._resetUsed = 0;
        this._writeUsed = 0;
        this._types.length = 0;
        this._targetMask.toZero();
        const archetype = this._access.archetype;
        if (!archetype) return;
        archetype.mask.copyTo(this._targetMask);
        for (let i = 0; i < archetype.types.length; i++) this._types.push(archetype.types[i]);
    }

    seal(): void {
        if (this._phase !== EntityTransactionPhase.Mutable) {
            throw new Error("EntityTransaction can only be sealed once while mutable");
        }
        this._phase = EntityTransactionPhase.Sealed;
    }

    /** @internal 只供 Game 提交扩展在合并前观察终止事务。 */
    willDespawn(): boolean {
        return (this._flags & EntityTransactionFlags.Despawn) !== 0;
    }

    merge(source: EntityTransaction): void {
        if (!(source instanceof EntityTransaction) || source.world !== this.world) {
            throw new Error("Cannot merge EntityTransactions from different Worlds");
        }
        if (source === this) throw new Error("EntityTransaction cannot merge itself");
        if (this._phase !== EntityTransactionPhase.Sealed || source._phase !== EntityTransactionPhase.Sealed) {
            throw new Error("Only sealed EntityTransactions can be merged");
        }
        if (source._entity !== this._entity) {
            throw new Error("Cannot merge EntityTransactions for different entities");
        }
        if ((this._flags & EntityTransactionFlags.Despawn) !== 0) {
            // 批次中的 despawn 是该实体的最终结果；后续独立事务不再改变它。
            return;
        }
        if ((source._flags & EntityTransactionFlags.Despawn) !== 0) {
            this.recordDespawn();
            return;
        }
        for (let i = 0; i < source._used; i += ENTITY_INSTRUCTION_SIZE) {
            const operation = source._instructions[i];
            const componentId = source._instructions[i + 1] as ComponentId;
            const component = this.world.componentById(componentId);
            if (!component) throw new RangeError(`Unknown component id ${componentId}`);
            if (operation === EntityInstruction.Add) this.recordAdd(component);
            else if (operation === EntityInstruction.Remove) this.recordRemove(component);
            else if (operation === EntityInstruction.Set) {
                this.recordSet(component, source._instructions[i + 2], source._instructions[i + 3]);
            } else throw new RangeError(`Unknown EntityTransaction instruction ${operation}`);
        }
    }

    release(): void {
        if (this._phase !== EntityTransactionPhase.Applied && this._phase !== EntityTransactionPhase.Sealed) {
            throw new Error("Only applied or merged EntityTransactions can be released");
        }
        this.recycle();
    }

    /** 回收尚未进入迁移队列的事务。 */
    cancel(): void {
        if (this._phase !== EntityTransactionPhase.Mutable) {
            throw new Error("Only mutable EntityTransactions can be cancelled");
        }
        this.recycle();
    }

    private recycle(): void {
        this._entity = 0 as Entity;
        this._flags = 0;
        this._used = 0;
        this._resetUsed = 0;
        this._writeUsed = 0;
        this._types.length = 0;
        this._targetMask.toZero();
        this._phase = EntityTransactionPhase.Recycled;
    }

    apply(): boolean {
        const world = this.world;
        if (this._phase === EntityTransactionPhase.Mutable) this.seal();
        if (this._phase !== EntityTransactionPhase.Sealed) {
            throw new Error("EntityTransaction has already been applied or recycled");
        }
        try {
            if (!world.valid(this._entity)) return false;
            if ((this._flags & EntityTransactionFlags.Despawn) !== 0) return world.despawn(this._entity);
            if (this._used === 0) return true;
            if ((this._flags & EntityTransactionFlags.Structural) !== 0) {
                return world.migrate(this._entity, this._targetMask, this._types, this.applyFields, this);
            }
            return this.writeFieldsDirect();
        } finally {
            this._phase = EntityTransactionPhase.Applied;
        }
    }

    private assertMutable(): void {
        if (this._phase === EntityTransactionPhase.Sealed) throw new Error("EntityCommand has already been submitted");
        if (this._phase === EntityTransactionPhase.Applied) throw new Error("EntityCommand has already been applied");
        if (this._phase === EntityTransactionPhase.Recycled) throw new Error("EntityCommand has already been recycled");
        if ((this._flags & EntityTransactionFlags.Despawn) !== 0) {
            throw new Error(`EntityCommand for ${this._entity} is already marked for despawn`);
        }
    }

    private recordAdd(component: ComponentMeta): void {
        const created = !this._targetMask.has(component.mask);
        if (created) {
            this._targetMask.orInto(component.mask);
            this._types.push(component);
            this.removeWrites(component.id);
            this.addReset(component.id);
            this._flags |= EntityTransactionFlags.Structural;
        }
        this.writeInstruction(
            EntityInstruction.Add,
            component.id,
            created ? AddInstructionFlags.CreatedLocalInstance : 0,
            0,
        );
    }

    private recordRemove(component: ComponentMeta): void {
        if (this._targetMask.has(component.mask)) {
            this._targetMask.andNotInto(component.mask);
            for (let i = 0; i < this._types.length; i++) {
                if (this._types[i].id !== component.id) continue;
                this._types[i] = this._types[this._types.length - 1];
                this._types.length--;
                break;
            }
            this.removeReset(component.id);
            this.removeWrites(component.id);
            this._flags |= EntityTransactionFlags.Structural;
        }
        this.writeInstruction(EntityInstruction.Remove, component.id, 0, 0);
    }

    private recordSet(component: ComponentMeta, field: number, value: number): void {
        if (!this._targetMask.has(component.mask)) this.recordAdd(component);
        for (let i = 0; i < this._writeUsed; i++) {
            if (this._writeComponents[i] !== component.id || this._writeFields[i] !== field) continue;
            this._writeValues[i] = value;
            this.writeInstruction(EntityInstruction.Set, component.id, field, value);
            return;
        }
        const index = this._writeUsed++;
        writeHighWater(this._writeComponents, index, component.id);
        writeHighWater(this._writeFields, index, field);
        writeHighWater(this._writeValues, index, value);
        this.writeInstruction(EntityInstruction.Set, component.id, field, value);
    }

    private recordDespawn(): void {
        this._flags |= EntityTransactionFlags.Despawn;
        this._used = 0;
        this._resetUsed = 0;
        this._writeUsed = 0;
        this._types.length = 0;
        this._targetMask.toZero();
    }

    private validateField(component: ComponentMeta, field: number): void {
        if (!Number.isInteger(field) || field < 0 || field >= component.layout.length) {
            throw new RangeError(
                `Component ${component.name} field ${field} is outside 0..${component.layout.length - 1}`,
            );
        }
    }

    private writeInstruction(
        operation: EntityInstruction,
        component: ComponentId,
        field: number,
        value: number,
    ): void {
        let index = this._used;
        writeHighWater(this._instructions, index++, operation);
        writeHighWater(this._instructions, index++, component);
        writeHighWater(this._instructions, index++, field);
        writeHighWater(this._instructions, index, value);
        this._used += ENTITY_INSTRUCTION_SIZE;
    }

    private addReset(component: ComponentId): void {
        for (let i = 0; i < this._resetUsed; i++) {
            if (this._resetComponents[i] === component) return;
        }
        writeHighWater(this._resetComponents, this._resetUsed++, component);
    }

    private removeReset(component: ComponentId): void {
        for (let i = 0; i < this._resetUsed; i++) {
            if (this._resetComponents[i] !== component) continue;
            this._resetUsed--;
            this._resetComponents[i] = this._resetComponents[this._resetUsed];
            return;
        }
    }

    private removeWrites(component: ComponentId): void {
        let index = 0;
        while (index < this._writeUsed) {
            if (this._writeComponents[index] !== component) {
                index++;
                continue;
            }
            this._writeUsed--;
            this._writeComponents[index] = this._writeComponents[this._writeUsed];
            this._writeFields[index] = this._writeFields[this._writeUsed];
            this._writeValues[index] = this._writeValues[this._writeUsed];
        }
    }

    private applyFields(archetype: Archetype, row: ArchetypeRow): void {
        const chunk = archetype.chunkAt(archetype.chunkIdxOf(row))!.views;
        const rowIdx = archetype.rowIdxOf(row);
        for (let i = 0; i < this._resetUsed; i++) {
            const componentId = this._resetComponents[i];
            const component = this.world.componentById(componentId)!;
            const fields = chunk[componentId]!;
            for (let field = 0; field < component.layout.length; field++) {
                fields[field][rowIdx] = 0;
            }
        }
        for (let i = 0; i < this._writeUsed; i++) {
            chunk[this._writeComponents[i]]![this._writeFields[i]][rowIdx] =
                this._writeValues[i];
        }
    }

    private writeFieldsDirect(): boolean {
        if (!this.world.resolve(this._entity, this._access)) return false;
        const archetype = this._access.archetype;
        if (!archetype) return false;
        const row = this._access.row;
        const chunk = archetype.chunkAt(archetype.chunkIdxOf(row))!.views;
        const rowIdx = archetype.rowIdxOf(row);
        for (let i = 0; i < this._writeUsed; i++) {
            const fields = chunk[this._writeComponents[i]];
            if (!fields || fields[this._writeFields[i]] === undefined) return false;
        }
        for (let i = 0; i < this._writeUsed; i++) {
            chunk[this._writeComponents[i]]![this._writeFields[i]][rowIdx] =
                this._writeValues[i];
        }
        return true;
    }
}

function writeHighWater<T>(values: T[], index: number, value: T): void {
    if (index < values.length) values[index] = value;
    else values.push(value);
}
