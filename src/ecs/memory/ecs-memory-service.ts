import { Service } from "../../context";
import { Allocator } from "../../storage/memory";

/** 持有并统一释放当前 World 使用的全部 ECS 内存。 */
export class EcsMemoryService extends Service {
    private readonly _allocator = new Allocator();

    /** 当前 World 独占的固定 Buffer 分配器。 */
    get allocator(): Allocator { return this._allocator; }

    /** 释放空 Block；仍有 Buffer 未归还时会抛出错误。 */
    dispose(): void {
        this.allocator.trim();
        this.allocator.clear();
    }
}
