import { BLOCK_SIZE, CHUNKS_PER_BLOCK, CHUNK_SIZE } from "./constants";
import type { AllocatorStats, ChunkHandle, IChunkAllocator, MemoryChunk } from "./types";

interface MemoryBlock {
    readonly id: number;
    readonly buffer: ArrayBuffer;
    readonly generations: Uint32Array;
    readonly allocated: Uint8Array;
    freeCount: number;
}

interface FreeChunk { readonly blockId: number; readonly chunkIndex: number }

export class ChunkAllocator implements IChunkAllocator {
    private readonly _blocks = new Map<number, MemoryBlock>();
    private readonly _freeList: FreeChunk[] = [];
    private _nextBlockId = 0;
    private _allocatedChunks = 0;

    alloc(): MemoryChunk {
        if (this._freeList.length === 0) this.grow();
        const location = this._freeList.pop()!;
        const block = this._blocks.get(location.blockId)!;
        if (block.allocated[location.chunkIndex] !== 0) throw new Error("Allocator free list is corrupted");
        block.allocated[location.chunkIndex] = 1;
        block.freeCount--;
        this._allocatedChunks++;
        return this.createView(block, location.chunkIndex);
    }

    free(handle: ChunkHandle): void {
        const block = this.requireBlock(handle);
        if (block.generations[handle.chunkIndex] !== handle.generation) throw new Error("Cannot free a stale chunk handle");
        if (block.allocated[handle.chunkIndex] === 0) throw new Error("Chunk has already been freed");
        block.allocated[handle.chunkIndex] = 0;
        block.generations[handle.chunkIndex] = (block.generations[handle.chunkIndex] + 1) >>> 0;
        block.freeCount++;
        this._allocatedChunks--;
        this._freeList.push({ blockId: handle.blockId, chunkIndex: handle.chunkIndex });
    }

    resolve(handle: ChunkHandle): MemoryChunk | null {
        const block = this._blocks.get(handle.blockId);
        if (!block || handle.chunkIndex < 0 || handle.chunkIndex >= CHUNKS_PER_BLOCK) return null;
        if (block.allocated[handle.chunkIndex] === 0 || block.generations[handle.chunkIndex] !== handle.generation) return null;
        return this.createView(block, handle.chunkIndex);
    }

    owns(handle: ChunkHandle): boolean { return this.resolve(handle) !== null; }

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

    trim(): number {
        const emptyIds = new Set<number>();
        for (const block of this._blocks.values()) if (block.freeCount === CHUNKS_PER_BLOCK) emptyIds.add(block.id);
        for (const id of emptyIds) this._blocks.delete(id);
        if (emptyIds.size > 0) {
            let write = 0;
            for (const entry of this._freeList) if (!emptyIds.has(entry.blockId)) this._freeList[write++] = entry;
            this._freeList.length = write;
        }
        return emptyIds.size;
    }

    clear(): void {
        if (this._allocatedChunks !== 0) throw new Error(`Cannot clear allocator with ${this._allocatedChunks} allocated chunk(s)`);
        this._blocks.clear();
        this._freeList.length = 0;
    }

    private grow(): void {
        const id = this._nextBlockId++;
        const block: MemoryBlock = {
            id,
            buffer: new ArrayBuffer(BLOCK_SIZE),
            generations: new Uint32Array(CHUNKS_PER_BLOCK),
            allocated: new Uint8Array(CHUNKS_PER_BLOCK),
            freeCount: CHUNKS_PER_BLOCK,
        };
        this._blocks.set(id, block);
        for (let i = CHUNKS_PER_BLOCK - 1; i >= 0; i--) this._freeList.push({ blockId: id, chunkIndex: i });
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
