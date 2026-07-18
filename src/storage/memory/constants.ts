/** 每个 Buffer 的固定大小：16 KiB。 */
export const BUFFER_SIZE = 16 * 1024;
/** Allocator 每次向运行时申请的大块大小：2 MiB。 */
export const BLOCK_SIZE = 2 * 1024 * 1024;
/** 每个 2 MiB Block 包含的 16 KiB Buffer 数量。 */
export const BUFFERS_PER_BLOCK = BLOCK_SIZE / BUFFER_SIZE;

if (!Number.isInteger(BUFFERS_PER_BLOCK)) throw new Error("BLOCK_SIZE must be divisible by BUFFER_SIZE");
