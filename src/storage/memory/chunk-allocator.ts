import { BLOCK_SIZE, CHUNKS_PER_BLOCK, CHUNK_SIZE } from "./constants";
import type { AllocatorStats, ChunkHandle, IChunkAllocator, MemoryChunk } from "./types";

interface MemoryBlock {
    readonly id: number;
    readonly buffer: ArrayBuffer;
    readonly generations: Uint32Array;
    readonly allocated: Uint8Array;
    freeCount: number;
}

/** 从 2 MiB Block 中分配固定 16 KiB Chunk 的内存分配器。 */
export class ChunkAllocator implements IChunkAllocator {
    private readonly _blocks = new Map<number, MemoryBlock>();
    private readonly _freeList: number[] = [];
    private _nextBlockId = 0;
    private _allocatedChunks = 0;

    /** 分配一个 Chunk；无空闲空间时自动增加一个 Block。 */
    alloc(): MemoryChunk {
        if (this._freeList.length === 0) this.grow();
        const location = this._freeList.pop()!;
        const blockId = Math.floor(location / CHUNKS_PER_BLOCK);
        const chunkIndex = location - blockId * CHUNKS_PER_BLOCK;
        const block = this._blocks.get(blockId)!;
        if (block.allocated[chunkIndex] !== 0) throw new Error("Allocator free list is corrupted");
        block.allocated[chunkIndex] = 1;
        block.freeCount--;
        this._allocatedChunks++;
        return this.createView(block, chunkIndex);
    }

    /** 释放 Chunk，并通过代数递增使旧句柄失效。 */
    free(handle: ChunkHandle): void {
        const block = this.requireBlock(handle);
        if (block.generations[handle.chunkIndex] !== handle.generation) throw new Error("Cannot free a stale chunk handle");
        if (block.allocated[handle.chunkIndex] === 0) throw new Error("Chunk has already been freed");
        block.allocated[handle.chunkIndex] = 0;
        block.generations[handle.chunkIndex] = (block.generations[handle.chunkIndex] + 1) >>> 0;
        block.freeCount++;
        this._allocatedChunks--;
        this._freeList.push(handle.blockId * CHUNKS_PER_BLOCK + handle.chunkIndex);
    }

    /** 解析有效 Chunk 句柄；无效、已释放或过期时返回 `null`。 */
    resolve(handle: ChunkHandle): MemoryChunk | null {
        const block = this._blocks.get(handle.blockId);
        if (!block || handle.chunkIndex < 0 || handle.chunkIndex >= CHUNKS_PER_BLOCK) return null;
        if (block.allocated[handle.chunkIndex] === 0 || block.generations[handle.chunkIndex] !== handle.generation) return null;
        return this.createView(block, handle.chunkIndex);
    }

    /** 判断句柄是否指向当前分配器仍在使用的 Chunk。 */
    owns(handle: ChunkHandle): boolean {
        const block = this._blocks.get(handle.blockId);
        return !!block &&
            Number.isInteger(handle.chunkIndex) &&
            handle.chunkIndex >= 0 &&
            handle.chunkIndex < CHUNKS_PER_BLOCK &&
            block.allocated[handle.chunkIndex] !== 0 &&
            block.generations[handle.chunkIndex] === handle.generation;
    }

    /** 返回当前 Block、Chunk 与字节占用统计。 */
    stats(): AllocatorStats {
        const blockCount = this._blocks.size;
        const chunkCapacity = blockCount * CHUNKS_PER_BLOCK;
        return {
            blockCount,
            chunkCapacity,
            allocatedChunks: this._allocatedChunks,
            freeChunks: chunkCapacity - this._allocatedChunks,
            reservedBytes: blockCount * BLOCK_SIZE,
            allocatedBytes: this._allocatedChunks * CHUNK_SIZE,
        };
    }

    /** 释放全部空 Block，并返回释放的 Block 数量。 */
    trim(): number {
        const emptyIds = new Set<number>();
        for (const block of this._blocks.values()) if (block.freeCount === CHUNKS_PER_BLOCK) emptyIds.add(block.id);
        for (const id of emptyIds) this._blocks.delete(id);
        if (emptyIds.size > 0) {
            let write = 0;
            for (let i = 0; i < this._freeList.length; i++) {
                const entry = this._freeList[i];
                const blockId = Math.floor(entry / CHUNKS_PER_BLOCK);
                if (!emptyIds.has(blockId)) this._freeList[write++] = entry;
            }
            this._freeList.length = write;
        }
        return emptyIds.size;
    }

    /** 清空分配器；仍有 Chunk 在使用时拒绝执行。 */
    clear(): void {
        if (this._allocatedChunks !== 0) throw new Error(`Cannot clear allocator with ${this._allocatedChunks} allocated chunk(s)`);
        this._blocks.clear();
        this._freeList.length = 0;
    }

    private grow(): void {
        const id = this._nextBlockId++;
        if (id > Math.floor(Number.MAX_SAFE_INTEGER / CHUNKS_PER_BLOCK) - 1) {
            throw new RangeError("ChunkAllocator block id capacity exceeded");
        }
        const block: MemoryBlock = {
            id,
            buffer: new ArrayBuffer(BLOCK_SIZE),
            generations: new Uint32Array(CHUNKS_PER_BLOCK),
            allocated: new Uint8Array(CHUNKS_PER_BLOCK),
            freeCount: CHUNKS_PER_BLOCK,
        };
        this._blocks.set(id, block);
        for (let i = CHUNKS_PER_BLOCK - 1; i >= 0; i--) this._freeList.push(id * CHUNKS_PER_BLOCK + i);
    }

    private createView(block: MemoryBlock, chunkIndex: number): MemoryChunk {
        return {
            handle: { blockId: block.id, chunkIndex, generation: block.generations[chunkIndex] },
            buffer: block.buffer,
            byteOffset: chunkIndex * CHUNK_SIZE,
            byteLength: CHUNK_SIZE,
        };
    }

    private requireBlock(handle: ChunkHandle): MemoryBlock {
        const block = this._blocks.get(handle.blockId);
        if (!block) throw new Error(`Unknown memory block: ${handle.blockId}`);
        if (!Number.isInteger(handle.chunkIndex) || handle.chunkIndex < 0 || handle.chunkIndex >= CHUNKS_PER_BLOCK) {
            throw new RangeError(`Invalid chunk index: ${handle.chunkIndex}`);
        }
        return block;
    }
}
