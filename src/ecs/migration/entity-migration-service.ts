import { Service } from "../../context/types";
import { ArchetypeService } from "../archetype/archetype-service";
import { ENTITY_INSTRUCTION_SIZE, EntityInstruction } from "../command/entity-instruction";
import type { ComponentId } from "../component/component";
import { ComponentService } from "../component/component-registry";
import { EntityService, type Entity } from "../entity/entity-service";
import { MigrationPlan } from "./migration-plan";

/** Internal structural transaction merger. It is intentionally not publicly exported. */
export class EntityMigrationService extends Service {
    @Service.inject(ArchetypeService) private readonly _archetypes!: ArchetypeService;
    @Service.inject(ComponentService) private readonly _components!: ComponentService;
    @Service.inject(EntityService) private readonly _entities!: EntityService;

    private readonly _entityToPlan = new Map<Entity, number>();
    private readonly _plans: MigrationPlan[] = [];
    private _used = 0;

    has(entity: Entity): boolean { return this._entityToPlan.has(entity); }

    record(entity: Entity, instructions: readonly number[], used: number): void {
        if (!this._entities.valid(entity)) throw new RangeError(`Invalid entity ${entity}`);
        const plan = this.getOrCreate(entity);
        for (let i = 0; i < used; i += ENTITY_INSTRUCTION_SIZE) {
            const operation = instructions[i];
            const componentId = instructions[i + 1] as ComponentId;
            const component = this._components.getById(componentId);
            if (!component) throw new RangeError(`Unknown component id ${componentId}`);
            if (operation === EntityInstruction.Add) {
                plan.add(component);
            } else if (operation === EntityInstruction.Remove) {
                plan.remove(component);
            } else if (operation === EntityInstruction.Set) {
                plan.set(component, instructions[i + 2], instructions[i + 3]);
            } else {
                throw new RangeError(`Unknown EntityCommand instruction ${operation}`);
            }
        }
    }

    cancel(entity: Entity): void {
        const index = this._entityToPlan.get(entity);
        if (index === undefined) return;
        this._entityToPlan.delete(entity);
        this._plans[index].cancel();
    }

    flush(): void {
        for (let i = 0; i < this._used; i++) this._plans[i].flush(this._entities);
        this._entityToPlan.clear();
        this._used = 0;
    }

    dispose(): void {
        for (let i = 0; i < this._used; i++) this._plans[i].cancel();
        this._entityToPlan.clear();
        this._used = 0;
        this._plans.length = 0;
    }

    private getOrCreate(entity: Entity): MigrationPlan {
        const existing = this._entityToPlan.get(entity);
        if (existing !== undefined) return this._plans[existing];
        const index = this._used++;
        let plan = this._plans[index];
        if (!plan) {
            plan = new MigrationPlan(this._components);
            this._plans.push(plan);
        }
        const archetype = this._archetypes.getAtIdx(this._entities.getArchIdx(entity));
        plan.begin(entity, archetype);
        this._entityToPlan.set(entity, index);
        return plan;
    }
}
