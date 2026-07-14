import { Service } from "../../context/types";
import { ChunkAllocator } from "../../storage/memory";

/** 持有并统一释放当前 World 使用的全部 ECS 内存块。 */
export class EcsMemoryService extends Service {
    /** 当前 World 独占的固定 Chunk 分配器。 */
    readonly allocator = new ChunkAllocator();

    /** 释放空 Block；仍有 Chunk 未归还时会抛出错误。 */
    dispose(): void {
        this.allocator.trim();
        this.allocator.clear();
    }
}
