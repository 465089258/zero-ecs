import { Service } from "../context";
import {
    type AllocatorConfig,
    type AllocatorStats,
    type Buffer,
    type IAllocator,
} from "@zero-ecs/world";

/**
 * Game 侧的通用内存分配门面。
 *
 * 它借用构建 World 时使用的 IAllocator，不拥有也不清空分配器。Service 和上层模块可通过该
 * 能力与 World 使用相同的默认内存模型；申请者仍负责释放自己持有的 Buffer。
 */
export class AllocatorService extends Service implements IAllocator {
    private _allocator: IAllocator | undefined;

    constructor(allocator: IAllocator) {
        super();
        this._allocator = allocator;
    }

    /** 当前 Game 与 World 共用的原始分配器。 */
    get allocator(): IAllocator { return this.requireAllocator(); }

    /** 当前分配器实例的归一化配置。 */
    get config(): Readonly<AllocatorConfig> { return this.requireAllocator().config; }

    alloc(): Buffer { return this.requireAllocator().alloc(); }

    stats(): AllocatorStats { return this.requireAllocator().stats(); }

    /** 仅解除对借用分配器的引用；分配器所有权属于 World 或外部调用方。 */
    dispose(): void { this._allocator = undefined; }

    private requireAllocator(): IAllocator {
        if (!this._allocator) throw new Error("AllocatorService has been disposed");
        return this._allocator;
    }
}
