import {
    INVALID_ENTITY,
    type Buffer,
    type Entity,
    type EntityArray,
    type IAllocator,
} from "@zero-ecs/world";
import { entityIndexOf } from "@zero-ecs/world/game-bridge";

const COLUMN_COUNT = 6;
const BYTES_PER_ENTITY = COLUMN_COUNT * Uint32Array.BYTES_PER_ELEMENT;

interface HierarchyPage {
    readonly buffer: Buffer;
    readonly owners: EntityArray;
    readonly parents: EntityArray;
    readonly firstChildren: EntityArray;
    readonly lastChildren: EntityArray;
    readonly previousSiblings: EntityArray;
    readonly nextSiblings: EntityArray;
}

/** @internal 分页保存关系边；不向 Query 或 World 暴露其物理布局。 */
export class HierarchyStore {
    private readonly _pages: Array<HierarchyPage | undefined> = [];
    private readonly _pageCapacity: number;
    private _disposed = false;

    constructor(private readonly _allocator: IAllocator) {
        this._pageCapacity = Math.floor(_allocator.config.bufferByteLength / BYTES_PER_ENTITY);
        if (this._pageCapacity < 1) {
            throw new RangeError("Allocator Buffer is too small for a hierarchy page");
        }
    }

    parentOf(entity: Entity): Entity {
        const entry = this.readEntry(entity);
        return entry ? entry.page.parents[entry.offset] : INVALID_ENTITY;
    }

    firstChildOf(entity: Entity): Entity {
        const entry = this.readEntry(entity);
        return entry ? entry.page.firstChildren[entry.offset] : INVALID_ENTITY;
    }

    lastChildOf(entity: Entity): Entity {
        const entry = this.readEntry(entity);
        return entry ? entry.page.lastChildren[entry.offset] : INVALID_ENTITY;
    }

    previousSiblingOf(entity: Entity): Entity {
        const entry = this.readEntry(entity);
        return entry ? entry.page.previousSiblings[entry.offset] : INVALID_ENTITY;
    }

    nextSiblingOf(entity: Entity): Entity {
        const entry = this.readEntry(entity);
        return entry ? entry.page.nextSiblings[entry.offset] : INVALID_ENTITY;
    }

    /** 将 child 追加到 parent 的子链尾部，返回旧父节点。 */
    setParent(child: Entity, parent: Entity): Entity {
        if (child === parent) throw new Error("An entity cannot be its own parent");
        for (let cursor = parent, remaining = 0x100000; cursor !== INVALID_ENTITY; remaining--) {
            if (cursor === child) throw new Error("Hierarchy relation would create a cycle");
            if (remaining === 0) throw new Error("Hierarchy parent chain is corrupted");
            cursor = this.parentOf(cursor);
        }

        const childEntry = this.ensureEntry(child);
        const oldParent = childEntry.page.parents[childEntry.offset];
        if (oldParent === parent) return oldParent;
        if (oldParent !== INVALID_ENTITY) this.detach(child, childEntry, oldParent);

        const parentEntry = this.ensureEntry(parent);
        const previous = parentEntry.page.lastChildren[parentEntry.offset];
        childEntry.page.parents[childEntry.offset] = parent;
        childEntry.page.previousSiblings[childEntry.offset] = previous;
        childEntry.page.nextSiblings[childEntry.offset] = INVALID_ENTITY;
        if (previous === INVALID_ENTITY) {
            parentEntry.page.firstChildren[parentEntry.offset] = child;
        } else {
            const previousEntry = this.ensureEntry(previous);
            previousEntry.page.nextSiblings[previousEntry.offset] = child;
        }
        parentEntry.page.lastChildren[parentEntry.offset] = child;
        return oldParent;
    }

    /** 从当前父节点移除 child，返回旧父节点。 */
    removeParent(child: Entity): Entity {
        const childEntry = this.readEntry(child);
        if (!childEntry) return INVALID_ENTITY;
        const oldParent = childEntry.page.parents[childEntry.offset];
        if (oldParent !== INVALID_ENTITY) this.detach(child, childEntry, oldParent);
        return oldParent;
    }

    /** 清除实体自身的全部关系字段；调用方负责先保存需要遍历的子链。 */
    clear(entity: Entity): void {
        const entry = this.readEntry(entity);
        if (!entry) return;
        this.clearAt(entry.page, entry.offset);
    }

    dispose(): void {
        if (this._disposed) return;
        this._disposed = true;
        let firstError: unknown;
        for (let i = 0; i < this._pages.length; i++) {
            const page = this._pages[i];
            if (!page) continue;
            try { page.buffer.dispose(); }
            catch (error) { firstError ??= error; }
        }
        this._pages.length = 0;
        if (firstError !== undefined) throw firstError;
    }

    private detach(
        child: Entity,
        childEntry: Readonly<HierarchyEntry>,
        parent: Entity,
    ): void {
        const parentEntry = this.readEntry(parent);
        const previous = childEntry.page.previousSiblings[childEntry.offset];
        const next = childEntry.page.nextSiblings[childEntry.offset];

        if (previous !== INVALID_ENTITY) {
            const previousEntry = this.readEntry(previous);
            if (previousEntry) previousEntry.page.nextSiblings[previousEntry.offset] = next;
        } else if (parentEntry) {
            parentEntry.page.firstChildren[parentEntry.offset] = next;
        }
        if (next !== INVALID_ENTITY) {
            const nextEntry = this.readEntry(next);
            if (nextEntry) nextEntry.page.previousSiblings[nextEntry.offset] = previous;
        } else if (parentEntry) {
            parentEntry.page.lastChildren[parentEntry.offset] = previous;
        }

        childEntry.page.parents[childEntry.offset] = INVALID_ENTITY;
        childEntry.page.previousSiblings[childEntry.offset] = INVALID_ENTITY;
        childEntry.page.nextSiblings[childEntry.offset] = INVALID_ENTITY;
    }

    private readEntry(entity: Entity): HierarchyEntry | undefined {
        if (entity === INVALID_ENTITY || this._disposed) return undefined;
        const index = entityIndexOf(entity);
        const page = this._pages[Math.floor(index / this._pageCapacity)];
        if (!page) return undefined;
        const offset = index % this._pageCapacity;
        return page.owners[offset] === entity ? { page, offset } : undefined;
    }

    private ensureEntry(entity: Entity): HierarchyEntry {
        if (entity === INVALID_ENTITY) throw new RangeError("Hierarchy entity cannot be INVALID_ENTITY");
        if (this._disposed) throw new Error("HierarchyStore has been disposed");
        const index = entityIndexOf(entity);
        const pageIndex = Math.floor(index / this._pageCapacity);
        let page = this._pages[pageIndex];
        if (!page) {
            page = this.createPage();
            this._pages[pageIndex] = page;
        }
        const offset = index % this._pageCapacity;
        if (page.owners[offset] !== entity) {
            this.clearAt(page, offset);
            page.owners[offset] = entity;
        }
        return { page, offset };
    }

    private createPage(): HierarchyPage {
        const buffer = this._allocator.alloc();
        try {
            const length = this._pageCapacity;
            const page: HierarchyPage = {
                buffer,
                owners: buffer.entity(length),
                parents: buffer.entity(length),
                firstChildren: buffer.entity(length),
                lastChildren: buffer.entity(length),
                previousSiblings: buffer.entity(length),
                nextSiblings: buffer.entity(length),
            };
            buffer.zero();
            return page;
        } catch (error) {
            buffer.dispose();
            throw error;
        }
    }

    private clearAt(page: HierarchyPage, offset: number): void {
        page.owners[offset] = INVALID_ENTITY;
        page.parents[offset] = INVALID_ENTITY;
        page.firstChildren[offset] = INVALID_ENTITY;
        page.lastChildren[offset] = INVALID_ENTITY;
        page.previousSiblings[offset] = INVALID_ENTITY;
        page.nextSiblings[offset] = INVALID_ENTITY;
    }
}

interface HierarchyEntry {
    readonly page: HierarchyPage;
    readonly offset: number;
}

