import type { Buffer } from "./buffer";

/** Allocator 当前的内存统计快照。 */
export interface AllocatorStats {
    readonly blockCount: number;
    readonly bufferCapacity: number;
    readonly allocatedBuffers: number;
    readonly freeBuffers: number;
    readonly reservedBytes: number;
    readonly allocatedBytes: number;
}

/** 固定大小 Buffer 分配器接口。 */
export interface IAllocator {
    /** 分配一个 16 KiB Buffer。 */
    alloc(): Buffer;
    /** 获取分配器统计快照。 */
    stats(): AllocatorStats;
}
