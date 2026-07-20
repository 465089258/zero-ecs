import type { AllocatorConfig } from "./types";

const enum DefaultAllocatorConstants {
    BufferByteLength = 16 * 1024,
    BlockByteLength = 2 * 1024 * 1024,
    BuffersPerBlock = DefaultAllocatorConstants.BlockByteLength /
        DefaultAllocatorConstants.BufferByteLength,
}

/** Allocator 未显式配置时使用的冻结内存方案。 */
export const defaultAllocatorConfig: Readonly<AllocatorConfig> = Object.freeze({
    bufferByteLength: DefaultAllocatorConstants.BufferByteLength,
    blockByteLength: DefaultAllocatorConstants.BlockByteLength,
    buffersPerBlock: DefaultAllocatorConstants.BuffersPerBlock,
});
