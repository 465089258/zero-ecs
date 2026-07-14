import { Service } from "../../context/types";
import { ChunkAllocator } from "../../storage/memory";

/** Owns all ECS blocks allocated by a World. */
export class EcsMemoryService extends Service {
    readonly allocator = new ChunkAllocator();

    dispose(): void {
        this.allocator.trim();
    }
}
