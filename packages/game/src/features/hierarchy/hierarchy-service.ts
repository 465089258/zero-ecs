import { INVALID_ENTITY, type Entity, type IAllocator, type World } from "@zero-ecs/world";
import { Inject, Service, type ServiceActivateContext } from "../../context";
import { Commands } from "../../command/command-service";
import { ChildOfStorage, ParentOfStorage } from "./storage-components";
import { HierarchyStore } from "./storage";

/** 可选 HierarchyModule 提供的父子关系读写服务。 */
export class HierarchyService extends Service {
    @Inject.world() private readonly _world!: World;

    private readonly _store: HierarchyStore;
    private _commands: Commands | undefined;
    private readonly _pendingChildren: Entity[] = [];
    private readonly _pendingParents: Entity[] = [];
    private _pendingUsed = 0;
    private readonly _stack: Entity[] = [];
    private _stackUsed = 0;

    /** 使用关系分页存储所借用的 Allocator 创建服务；通常由 HierarchyModule 构建。 */
    constructor(allocator: IAllocator) {
        super();
        this._store = new HierarchyStore(allocator);
    }

    activate(context: ServiceActivateContext): void {
        const commands = context.service(Commands);
        commands.addFlushExtension(this);
        this._commands = commands;
    }

    /** 取得当前已提交的父节点；根节点或无效实体返回 INVALID_ENTITY。 */
    parentOf(entity: Entity): Entity {
        return this._world.valid(entity) ? this._store.parentOf(entity) : INVALID_ENTITY;
    }

    /** 取得第一个子节点；没有子节点或实体无效时返回 INVALID_ENTITY。 */
    firstChildOf(entity: Entity): Entity {
        return this._world.valid(entity) ? this._store.firstChildOf(entity) : INVALID_ENTITY;
    }

    /** 取得最后一个子节点；没有子节点或实体无效时返回 INVALID_ENTITY。 */
    lastChildOf(entity: Entity): Entity {
        return this._world.valid(entity) ? this._store.lastChildOf(entity) : INVALID_ENTITY;
    }

    /** 取得前一个兄弟节点。 */
    previousSiblingOf(entity: Entity): Entity {
        return this._world.valid(entity) ? this._store.previousSiblingOf(entity) : INVALID_ENTITY;
    }

    /** 取得后一个兄弟节点。 */
    nextSiblingOf(entity: Entity): Entity {
        return this._world.valid(entity) ? this._store.nextSiblingOf(entity) : INVALID_ENTITY;
    }

    /** 判断实体当前是否拥有已提交的父节点。 */
    hasParent(entity: Entity): boolean { return this.parentOf(entity) !== INVALID_ENTITY; }

    /** 判断实体当前是否拥有至少一个已提交的子节点。 */
    hasChildren(entity: Entity): boolean { return this.firstChildOf(entity) !== INVALID_ENTITY; }

    /**
     * 延迟设置父节点；与普通 EntityCommand 一同在 Commands 提交边界生效。
     * 重设父节点不会改变子树内的其他边。
     */
    setParent(child: Entity, parent: Entity): void {
        this.requireValid(child, "child");
        this.requireValid(parent, "parent");
        if (child === parent) throw new Error("An entity cannot be its own parent");
        this.writePending(child, parent);
    }

    /** 延迟移除父节点，使实体及其子树成为根。 */
    removeParent(child: Entity): void {
        this.requireValid(child, "child");
        this.writePending(child, INVALID_ENTITY);
    }

    /** @internal 在结构事务合并前提交关系操作并展开递归 despawn。 */
    flushCommands(commands: Commands): void {
        this.commitRelations(commands);
        const count = commands.pendingEntityCommandCount;
        for (let i = 0; i < count; i++) {
            if (!commands.pendingEntityWillDespawnAt(i)) continue;
            this.expandDespawn(commands.pendingEntityAt(i), commands);
        }
    }

    dispose(): void {
        this._commands?.removeFlushExtension(this);
        this._commands = undefined;
        this._pendingUsed = 0;
        this._pendingChildren.length = 0;
        this._pendingParents.length = 0;
        this._stackUsed = 0;
        this._stack.length = 0;
        this._store.dispose();
    }

    private commitRelations(commands: Commands): void {
        const used = this._pendingUsed;
        this._pendingUsed = 0;
        for (let i = 0; i < used; i++) {
            const child = this._pendingChildren[i];
            const parent = this._pendingParents[i];
            this.requireValid(child, "child");
            if (parent === INVALID_ENTITY) this.commitRemoveParent(child, commands);
            else {
                this.requireValid(parent, "parent");
                this.commitSetParent(child, parent, commands);
            }
        }
    }

    private commitSetParent(child: Entity, parent: Entity, commands: Commands): void {
        const oldParent = this._store.parentOf(child);
        if (oldParent === parent) return;
        const oldParentHadOneChild = oldParent !== INVALID_ENTITY &&
            this._store.firstChildOf(oldParent) === child &&
            this._store.lastChildOf(oldParent) === child;
        const childWasRoot = oldParent === INVALID_ENTITY;
        const parentWasEmpty = this._store.firstChildOf(parent) === INVALID_ENTITY;
        this._store.setParent(child, parent);

        if (childWasRoot) commands.entity(child).add(ChildOfStorage).submit();
        if (oldParentHadOneChild && this._world.valid(oldParent)) {
            commands.entity(oldParent).remove(ParentOfStorage).submit();
        }
        if (parentWasEmpty) commands.entity(parent).add(ParentOfStorage).submit();
    }

    private commitRemoveParent(child: Entity, commands: Commands): void {
        const oldParent = this._store.parentOf(child);
        if (oldParent === INVALID_ENTITY) return;
        const oldParentHadOneChild = this._store.firstChildOf(oldParent) === child &&
            this._store.lastChildOf(oldParent) === child;
        this._store.removeParent(child);
        commands.entity(child).remove(ChildOfStorage).submit();
        if (oldParentHadOneChild && this._world.valid(oldParent)) {
            commands.entity(oldParent).remove(ParentOfStorage).submit();
        }
    }

    private expandDespawn(root: Entity, commands: Commands): void {
        if (!this._world.valid(root)) return;
        const externalParent = this._store.parentOf(root);
        if (externalParent !== INVALID_ENTITY) {
            const parentLosesLastChild = this._store.firstChildOf(externalParent) === root &&
                this._store.lastChildOf(externalParent) === root;
            this._store.removeParent(root);
            if (parentLosesLastChild && this._world.valid(externalParent)) {
                commands.entity(externalParent).remove(ParentOfStorage).submit();
            }
        }

        this._stackUsed = 0;
        this.pushStack(root);
        while (this._stackUsed > 0) {
            const entity = this._stack[--this._stackUsed];
            let child = this._store.firstChildOf(entity);
            while (child !== INVALID_ENTITY) {
                const next = this._store.nextSiblingOf(child);
                this.pushStack(child);
                child = next;
            }
            this._store.clear(entity);
            if (entity !== root && this._world.valid(entity)) {
                commands.entity(entity).despawn().submit();
            }
        }
    }

    private writePending(child: Entity, parent: Entity): void {
        const index = this._pendingUsed++;
        writeHighWater(this._pendingChildren, index, child);
        writeHighWater(this._pendingParents, index, parent);
    }

    private pushStack(entity: Entity): void {
        writeHighWater(this._stack, this._stackUsed++, entity);
    }

    private requireValid(entity: Entity, role: string): void {
        if (!this._world.valid(entity)) throw new RangeError(`Invalid hierarchy ${role} entity ${entity}`);
    }
}

function writeHighWater<T>(values: T[], index: number, value: T): void {
    if (index < values.length) values[index] = value;
    else values.push(value);
}
