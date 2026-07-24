/** 参与 Canvas 画家算法的最小排序字段。 */
export interface DepthRenderItem {
    layer: number;
    depth: number;
    subOrder: number;
    stableId: number;
}

/** 默认渲染大层；世界对象之间仍应依靠 depth 决定遮挡。 */
export const FlyingSwordRenderLayer = Object.freeze({
    Background: 0,
    Ground: 10,
    Shadow: 20,
    World: 100,
    ForegroundEffect: 200,
    Interface: 1000,
} as const);

/** 按大层、远到近深度和稳定平局键排序。 */
export function compareDepthRenderItems(
    left: Readonly<DepthRenderItem>,
    right: Readonly<DepthRenderItem>,
): number {
    return left.layer - right.layer ||
        right.depth - left.depth ||
        left.subOrder - right.subOrder ||
        left.stableId - right.stableId;
}

/**
 * 复用渲染项对象的深度队列。
 *
 * begin() 后通过 acquire() 填充本帧数据，sort() 后从 items 读取。
 */
export class DepthRenderQueue<T extends DepthRenderItem> {
    private readonly pool: T[] = [];
    private readonly active: T[] = [];
    private used = 0;

    constructor(private readonly factory: () => T) {}

    get length(): number { return this.used; }
    get items(): readonly T[] { return this.active; }

    begin(): void {
        this.used = 0;
        this.active.length = 0;
    }

    acquire(): T {
        const index = this.used++;
        let item = this.pool[index];
        if (!item) {
            item = this.factory();
            this.pool.push(item);
        }
        this.active.push(item);
        return item;
    }

    sort(): void {
        this.active.sort(compareDepthRenderItems);
    }

    trim(retain = this.used): void {
        if (!Number.isSafeInteger(retain) || retain < 0) {
            throw new RangeError("retain must be a non-negative safe integer");
        }
        if (this.pool.length > retain) this.pool.length = retain;
    }
}
