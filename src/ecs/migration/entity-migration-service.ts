import { ArchetypeService } from "../archetype/archetype-service";
import { ENTITY_INSTRUCTION_SIZE, EntityInstruction } from "../command/entity-instruction";
import type { ComponentId } from "../component/component";
import { ComponentService } from "../component/component-registry";
import { EntityService, type Entity } from "../entity/entity-service";
import { ENTITY_VERSION_BITS } from "../entity/entity-format";
import { MigrationPlan } from "./migration-plan";
import { Service, State } from "../../context";
import type { Mut } from "../../schedule/system";

/** 当前 Post 周期的实体迁移计划状态。 */
export class EntityMigrationState extends State {
    readonly entityToPlan = new EntityPlanIndex();
    readonly plans: MigrationPlan[] = [];
    readonly used: number = 0;
}

/** @internal 当前 World 的迁移计划对象池；不属于当前 Post 事务状态。 */
export class EntityMigrationPoolService extends Service {
    @Service.inject(ComponentService) private readonly _components!: ComponentService;
    private readonly _plans: MigrationPlan[] = [];

    acquire(): MigrationPlan {
        return this._plans.pop() ?? new MigrationPlan(this._components);
    }

    recycle(plan: MigrationPlan): void {
        plan.cancel();
        this._plans.push(plan);
    }

    trim(retain: number): void {
        if (this._plans.length > retain) this._plans.length = retain;
    }

    dispose(): void { this._plans.length = 0; }
}

/** @internal 合并同一 Post 周期内实体结构事务的迁移服务。 */
export class EntityMigrationService extends Service {
    @Service.inject(ArchetypeService) private readonly _archetypes!: ArchetypeService;
    @Service.inject(ComponentService) private readonly _components!: ComponentService;
    @Service.inject(EntityService) private readonly _entities!: EntityService;
    @Service.inject(EntityMigrationPoolService) private readonly _pool!: EntityMigrationPoolService;

    @State.inject(EntityMigrationState) private readonly _state!: Mut<EntityMigrationState>;

    /** 判断实体是否已有待提交迁移计划。 */
    has(entity: Entity): boolean { return this._state.entityToPlan.has(entity); }

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
        const index = this._state.entityToPlan.get(entity);
        if (index === undefined) return;
        this._state.entityToPlan.delete(entity);
        this._state.plans[index].cancel();
    }

    /** @internal 在显式空闲边界裁剪池化迁移计划。 */
    trimPlans(retain = 0): void {
        if (this._state.used !== 0) throw new Error("Cannot trim migration plans while migrations are pending");
        if (!Number.isSafeInteger(retain) || retain < 0) {
            throw new RangeError("retain must be a non-negative safe integer");
        }
        this._pool.trim(retain);
        this._state.entityToPlan.trim();
    }

    /** 取消待提交迁移并释放所有计划。 */
    dispose(): void {
        const state = this._state;
        for (let i = 0; i < state.used; i++) this._pool.recycle(state.plans[i]);
        state.entityToPlan.clear();
        state.used = 0;
        state.plans.length = 0;
    }

    private getOrCreate(entity: Entity): MigrationPlan {
        const state = this._state;
        const existing = state.entityToPlan.get(entity);
        if (existing !== undefined) return state.plans[existing];
        const index = state.used++;
        const plan = this._pool.acquire();
        state.plans.push(plan);
        const archetype = this._archetypes.getAtIdx(this._entities.getArchIdx(entity));
        plan.begin(entity, archetype);
        state.entityToPlan.set(entity, index);
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
