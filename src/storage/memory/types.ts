export interface ChunkHandle {
    readonly blockId: number;
    readonly chunkIndex: number;
    readonly generation: number;
}

export interface MemoryChunk {
    readonly handle: ChunkHandle;
    readonly buffer: ArrayBuffer;
    readonly byteOffset: number;
    readonly byteLength: number;
}

export interface AllocatorStats {
    readonly blockCount: number;
    readonly chunkCapacity: number;
    readonly allocatedChunks: number;
    readonly freeChunks: number;
    readonly reservedBytes: number;
    readonly allocatedBytes: number;
}

export interface IChunkAllocator {
    alloc(): MemoryChunk;
    free(handle: ChunkHandle): void;
    resolve(handle: ChunkHandle): MemoryChunk | null;
    owns(handle: ChunkHandle): boolean;
    stats(): AllocatorStats;
}
