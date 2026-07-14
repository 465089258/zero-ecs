import { Service } from "../../context/types";
import { ArchetypeService } from "../archetype/archetype-service";
import { ENTITY_INSTRUCTION_SIZE, EntityInstruction } from "../command/entity-instruction";
import type { ComponentId } from "../component/component";
import { ComponentService } from "../component/component-registry";
import { EntityService, type Entity } from "../entity/entity-service";
import { ENTITY_VERSION_BITS } from "../entity/entity-format";
import { MigrationPlan } from "./migration-plan";

/** @internal 合并同一 Post 周期内实体结构事务的迁移服务。 */
export class EntityMigrationService extends Service {
    @Service.inject(ArchetypeService) private readonly _archetypes!: ArchetypeService;
    @Service.inject(ComponentService) private readonly _components!: ComponentService;
    @Service.inject(EntityService) private readonly _entities!: EntityService;

    private readonly _entityToPlan = new EntityPlanIndex();
    private readonly _plans: MigrationPlan[] = [];
    private _used = 0;

    /** 判断实体是否已有待提交迁移计划。 */
    has(entity: Entity): boolean { return this._entityToPlan.has(entity); }

    /** 合并一个 EntityCommand 的有效指令。 */
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

    /** 取消实体尚未提交的迁移计划。 */
    cancel(entity: Entity): void {
        const index = this._entityToPlan.get(entity);
        if (index === undefined) return;
        this._entityToPlan.delete(entity);
        this._plans[index].cancel();
    }

    /** 提交全部迁移计划，并保留计划对象供后续复用。 */
    flush(): void {
        for (let i = 0; i < this._used; i++) this._plans[i].flush(this._entities);
        this._entityToPlan.clear();
        this._used = 0;
    }

    /** @internal 在显式空闲边界裁剪池化迁移计划。 */
    trimPlans(retain = 0): void {
        if (this._used !== 0) throw new Error("Cannot trim migration plans while migrations are pending");
        if (!Number.isSafeInteger(retain) || retain < 0) {
            throw new RangeError("retain must be a non-negative safe integer");
        }
        if (this._plans.length > retain) this._plans.length = retain;
        this._entityToPlan.trim();
    }

    /** 取消待提交迁移并释放所有计划。 */
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

const ENTITY_PAGE_SHIFT = 10;
const ENTITY_PAGE_SIZE = 1 << ENTITY_PAGE_SHIFT;
const ENTITY_PAGE_MASK = ENTITY_PAGE_SIZE - 1;

interface EntityPlanPage {
    readonly entities: Uint32Array;
    readonly plans: Uint32Array;
}

/** 仅在一个 Post 事务内使用的稀疏分页索引。 */
class EntityPlanIndex {
    private readonly _pages: Array<EntityPlanPage | undefined> = [];
    private readonly _touched: number[] = [];
    private _touchedUsed = 0;

    has(entity: Entity): boolean { return this.get(entity) !== undefined; }

    get(entity: Entity): number | undefined {
        const rawIndex = entity >>> ENTITY_VERSION_BITS;
        const page = this._pages[rawIndex >>> ENTITY_PAGE_SHIFT];
        const offset = rawIndex & ENTITY_PAGE_MASK;
        return page && page.entities[offset] === entity ? page.plans[offset] - 1 : undefined;
    }

    set(entity: Entity, plan: number): void {
        const rawIndex = entity >>> ENTITY_VERSION_BITS;
        const pageIndex = rawIndex >>> ENTITY_PAGE_SHIFT;
        let page = this._pages[pageIndex];
        if (!page) {
            page = {
                entities: new Uint32Array(ENTITY_PAGE_SIZE),
                plans: new Uint32Array(ENTITY_PAGE_SIZE),
            };
            this._pages[pageIndex] = page;
        }
        const offset = rawIndex & ENTITY_PAGE_MASK;
        if (page.entities[offset] === 0) writeHighWater(this._touched, this._touchedUsed++, rawIndex);
        page.entities[offset] = entity;
        page.plans[offset] = plan + 1;
    }

    delete(entity: Entity): void {
        const rawIndex = entity >>> ENTITY_VERSION_BITS;
        const page = this._pages[rawIndex >>> ENTITY_PAGE_SHIFT];
        const offset = rawIndex & ENTITY_PAGE_MASK;
        if (!page || page.entities[offset] !== entity) return;
        page.entities[offset] = 0;
        page.plans[offset] = 0;
    }

    clear(): void {
        for (let i = 0; i < this._touchedUsed; i++) {
            const rawIndex = this._touched[i];
            const page = this._pages[rawIndex >>> ENTITY_PAGE_SHIFT]!;
            const offset = rawIndex & ENTITY_PAGE_MASK;
            page.entities[offset] = 0;
            page.plans[offset] = 0;
        }
        this._touchedUsed = 0;
    }

    trim(): void {
        this._pages.length = 0;
        this._touched.length = 0;
        this._touchedUsed = 0;
    }
}

function writeHighWater(values: number[], index: number, value: number): void {
    if (index < values.length) values[index] = value;
    else values.push(value);
}
