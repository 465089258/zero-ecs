import { BLOCK_SIZE, BUFFERS_PER_BLOCK, BUFFER_SIZE } from "./constants";
import { Buffer } from "./buffer";
import type { AllocatorStats, IAllocator } from "./types";

interface MemoryBlock {
    readonly id: number;
    readonly source: ArrayBuffer;
    readonly active: Array<Buffer | undefined>;
    freeCount: number;
}

/** 从 2 MiB Block 中分配固定 16 KiB Buffer 的内存分配器。 */
export class Allocator implements IAllocator {
    private readonly _blocks = new Map<number, MemoryBlock>();
    private readonly _freeList: number[] = [];
    private _nextBlockId = 0;
    private _allocatedBuffers = 0;

    /** 分配一个新 Buffer 对象；无空闲区域时自动增加一个 Block。 */
    alloc(): Buffer {
        if (this._freeList.length === 0) this.grow();
        const location = this._freeList.pop()!;
        const blockId = Math.floor(location / BUFFERS_PER_BLOCK);
        const bufferIndex = location - blockId * BUFFERS_PER_BLOCK;
        const block = this._blocks.get(blockId)!;
        if (block.active[bufferIndex] !== undefined) throw new Error("Allocator free list is corrupted");

        const buffer = Buffer.create(block.source, bufferIndex * BUFFER_SIZE, location, this);
        block.active[bufferIndex] = buffer;
        block.freeCount--;
        this._allocatedBuffers++;
        return buffer;
    }

    /** @internal 接收 Buffer.release() 的归还请求。 */
    releaseBuffer(buffer: Buffer, location: number): void {
        if (!Number.isSafeInteger(location) || location < 0) throw new Error("Invalid Buffer allocation");
        const blockId = Math.floor(location / BUFFERS_PER_BLOCK);
        const bufferIndex = location - blockId * BUFFERS_PER_BLOCK;
        const block = this._blocks.get(blockId);
        if (!block || bufferIndex < 0 || bufferIndex >= BUFFERS_PER_BLOCK) {
            throw new Error("Buffer does not belong to this Allocator");
        }
        if (block.active[bufferIndex] !== buffer) throw new Error("Buffer is not the active allocation");

        block.active[bufferIndex] = undefined;
        block.freeCount++;
        this._allocatedBuffers--;
        this._freeList.push(location);
    }

    /** 返回当前 Block、Buffer 与字节占用统计。 */
    stats(): AllocatorStats {
        const blockCount = this._blocks.size;
        const bufferCapacity = blockCount * BUFFERS_PER_BLOCK;
        return {
            blockCount,
            bufferCapacity,
            allocatedBuffers: this._allocatedBuffers,
            freeBuffers: bufferCapacity - this._allocatedBuffers,
            reservedBytes: blockCount * BLOCK_SIZE,
            allocatedBytes: this._allocatedBuffers * BUFFER_SIZE,
        };
    }

    /** 释放全部空 Block，并返回释放的 Block 数量。 */
    trim(): number {
        const emptyIds = new Set<number>();
        for (const block of this._blocks.values()) {
            if (block.freeCount === BUFFERS_PER_BLOCK) emptyIds.add(block.id);
        }
        for (const id of emptyIds) this._blocks.delete(id);
        if (emptyIds.size > 0) {
            let write = 0;
            for (let i = 0; i < this._freeList.length; i++) {
                const entry = this._freeList[i];
                const blockId = Math.floor(entry / BUFFERS_PER_BLOCK);
                if (!emptyIds.has(blockId)) this._freeList[write++] = entry;
            }
            this._freeList.length = write;
        }
        return emptyIds.size;
    }

    /** 清空分配器；仍有 Buffer 在使用时拒绝执行。 */
    clear(): void {
        if (this._allocatedBuffers !== 0) {
            throw new Error(`Cannot clear allocator with ${this._allocatedBuffers} allocated Buffer(s)`);
        }
        this._blocks.clear();
        this._freeList.length = 0;
    }

    private grow(): void {
        const id = this._nextBlockId++;
        if (id > Math.floor(Number.MAX_SAFE_INTEGER / BUFFERS_PER_BLOCK) - 1) {
            throw new RangeError("Allocator block id capacity exceeded");
        }
        const block: MemoryBlock = {
            id,
            source: new ArrayBuffer(BLOCK_SIZE),
            active: new Array<Buffer | undefined>(BUFFERS_PER_BLOCK),
            freeCount: BUFFERS_PER_BLOCK,
        };
        this._blocks.set(id, block);
        for (let i = BUFFERS_PER_BLOCK - 1; i >= 0; i--) {
            this._freeList.push(id * BUFFERS_PER_BLOCK + i);
        }
    }
}
