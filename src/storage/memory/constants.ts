export const CHUNK_SIZE = 16 * 1024;
export const BLOCK_SIZE = 2 * 1024 * 1024;
export const CHUNKS_PER_BLOCK = BLOCK_SIZE / CHUNK_SIZE;

if (!Number.isInteger(CHUNKS_PER_BLOCK)) throw new Error("BLOCK_SIZE must be divisible by CHUNK_SIZE");
