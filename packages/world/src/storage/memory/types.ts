import type { Buffer } from "./buffer";

/** 创建 Allocator 时可配置的内存分块方案。 */
export interface AllocatorOptions {
    /** 单个 Buffer 的字节数；必须是 4 的正整数倍。 */
    readonly bufferByteLength: number;
    /** 单个底层 Block 的字节数；必须能被 bufferByteLength 整除。 */
    readonly blockByteLength: number;
}

/** Allocator 归一化后的只读配置。 */
export interface AllocatorConfig extends AllocatorOptions {
    /** 每个 Block 包含的 Buffer 数量，由两个字节长度计算。 */
    readonly buffersPerBlock: number;
}

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
    /** 当前分配器实例使用的归一化内存方案。 */
    readonly config: Readonly<AllocatorConfig>;
    /** 按当前配置分配一个固定大小 Buffer。 */
    alloc(): Buffer;
    /** 获取分配器统计快照。 */
    stats(): AllocatorStats;
}
