import { Archetype, type ArchetypeRow } from "../archetype/archetype";
import type { ComponentId, ComponentMeta } from "../component/component";
import { ComponentService } from "../component/component-registry";
import { Mask } from "../component/mask";
import { EntityService, type Entity } from "../entity/entity-service";

/** Pooled final state for one entity in the current Post cycle. */
export class MigrationPlan {
    entity = 0 as Entity;
    active = false;
    readonly targetMask = Mask.empty();
    readonly types: ComponentMeta[] = [];

    private readonly _resetComponents: ComponentId[] = [];
    private _resetUsed = 0;
    private readonly _writeComponents: ComponentId[] = [];
    private readonly _writeFields: number[] = [];
    private readonly _writeValues: number[] = [];
    private _writeUsed = 0;
    private readonly _apply = (archetype: Archetype, row: ArchetypeRow): void => {
        this.apply(archetype, row);
    };

    constructor(private readonly _components: ComponentService) {}

    begin(entity: Entity, archetype: Archetype | undefined): void {
        this.entity = entity;
        this.active = true;
        this._resetUsed = 0;
        this._writeUsed = 0;
        this.types.length = 0;
        this.targetMask.toZero();
        if (!archetype) return;
        archetype.mask.copyTo(this.targetMask);
        for (let i = 0; i < archetype.types.length; i++) this.types.push(archetype.types[i]);
    }

    add(component: ComponentMeta): void {
        if (this.targetMask.has(component.mask)) return;
        this.targetMask.orInto(component.mask);
        this.types.push(component);
        this.removeWrites(component.id);
        this.addReset(component.id);
    }

    remove(component: ComponentMeta): void {
        if (!this.targetMask.has(component.mask)) return;
        this.targetMask.andNotInto(component.mask);
        for (let i = 0; i < this.types.length; i++) {
            if (this.types[i].id !== component.id) continue;
            this.types[i] = this.types[this.types.length - 1];
            this.types.length--;
            break;
        }
        this.removeReset(component.id);
        this.removeWrites(component.id);
    }

    set(component: ComponentMeta, field: number, value: number): void {
        if (!this.targetMask.has(component.mask)) this.add(component);
        for (let i = 0; i < this._writeUsed; i++) {
            if (this._writeComponents[i] !== component.id || this._writeFields[i] !== field) continue;
            this._writeValues[i] = value;
            return;
        }
        const index = this._writeUsed++;
        writeHighWater(this._writeComponents, index, component.id);
        writeHighWater(this._writeFields, index, field);
        writeHighWater(this._writeValues, index, value);
    }

    flush(entities: EntityService): void {
        if (!this.active) return;
        if (entities.valid(this.entity)) {
            entities.migrate(this.entity, this.targetMask, this.types, this._apply);
        }
        this.active = false;
    }

    cancel(): void { this.active = false; }

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

    private apply(archetype: Archetype, row: ArchetypeRow): void {
        for (let i = 0; i < this._resetUsed; i++) {
            const componentId = this._resetComponents[i];
            const component = this._components.getById(componentId)!;
            for (let field = 0; field < component.layout.length; field++) {
                archetype.setField(row, componentId, field, 0);
            }
        }
        for (let i = 0; i < this._writeUsed; i++) {
            archetype.setField(
                row,
                this._writeComponents[i],
                this._writeFields[i],
                this._writeValues[i],
            );
        }
    }
}

function writeHighWater<T>(values: T[], index: number, value: T): void {
    if (index < values.length) values[index] = value;
    else values.push(value);
}
