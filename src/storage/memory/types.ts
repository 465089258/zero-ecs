/** 带代数校验的 Chunk 句柄；释放后旧句柄失效。 */
export interface ChunkHandle {
    readonly blockId: number;
    readonly chunkIndex: number;
    readonly generation: number;
}

/** 从 2 MiB Block 切分出的 16 KiB 内存区域。 */
export interface MemoryChunk {
    readonly handle: ChunkHandle;
    readonly buffer: ArrayBuffer;
    readonly byteOffset: number;
    readonly byteLength: number;
}

/** ChunkAllocator 当前的内存统计快照。 */
export interface AllocatorStats {
    readonly blockCount: number;
    readonly chunkCapacity: number;
    readonly allocatedChunks: number;
    readonly freeChunks: number;
    readonly reservedBytes: number;
    readonly allocatedBytes: number;
}

/** 固定大小 Chunk 分配器接口。 */
export interface IChunkAllocator {
    /** 分配一个 16 KiB Chunk。 */
    alloc(): MemoryChunk;
    /** 释放句柄对应的 Chunk；句柄无效或重复释放时抛出错误。 */
    free(handle: ChunkHandle): void;
    /** 解析有效句柄；句柄已失效时返回 `null`。 */
    resolve(handle: ChunkHandle): MemoryChunk | null;
    /** 判断当前分配器是否持有该有效句柄。 */
    owns(handle: ChunkHandle): boolean;
    /** 获取分配器统计快照。 */
    stats(): AllocatorStats;
}
