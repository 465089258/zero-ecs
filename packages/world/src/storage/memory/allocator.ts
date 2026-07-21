import { defaultAllocatorConfig } from "./constants";
import { Buffer } from "./buffer";
import type {
    AllocatorConfig,
    AllocatorOptions,
    AllocatorStats,
    IAllocator,
} from "./types";

interface MemoryBlock {
    readonly id: number;
    readonly source: ArrayBuffer;
    readonly active: Array<AllocatorBuffer | undefined>;
    freeCount: number;
}

/** Allocator 内部租约：统一 Buffer API，dispose 时把区域归还给来源 Allocator。 */
class AllocatorBuffer extends Buffer {
    private _owner: Allocator | undefined;
    private _location: number;

    constructor(
        source: ArrayBuffer,
        byteOffset: number,
        byteLength: number,
        location: number,
        owner: Allocator,
    ) {
        super(source, byteOffset, byteLength);
        this._owner = owner;
        this._location = location;
    }

    override dispose(): void {
        const owner = this._owner;
        if (!owner) throw new Error("Buffer has been disposed");
        owner.releaseBuffer(this, this._location);
        this._owner = undefined;
        this._location = -1;
        this.detach();
    }
}

/** 按实例配置从大块内存中分配固定大小 Buffer。 */
export class Allocator implements IAllocator {
    private readonly _blocks = new Map<number, MemoryBlock>();
    private readonly _freeList: number[] = [];
    private _nextBlockId = 0;
    private _allocatedBuffers = 0;

    /** 当前实例使用的冻结、归一化配置。 */
    readonly config: Readonly<AllocatorConfig>;

    constructor(config: Readonly<AllocatorOptions> = defaultAllocatorConfig) {
        this.config = normalizeConfig(config);
    }

    /** 分配一个新 Buffer 对象；无空闲区域时自动增加一个 Block。 */
    alloc(): Buffer {
        if (this._freeList.length === 0) this.grow();
        const location = this._freeList.pop()!;
        const { bufferByteLength, buffersPerBlock } = this.config;
        const blockId = Math.floor(location / buffersPerBlock);
        const bufferIndex = location - blockId * buffersPerBlock;
        const block = this._blocks.get(blockId)!;
        if (block.active[bufferIndex] !== undefined) throw new Error("Allocator free list is corrupted");

        const buffer = new AllocatorBuffer(
            block.source,
            bufferIndex * bufferByteLength,
            bufferByteLength,
            location,
            this,
        );
        block.active[bufferIndex] = buffer;
        block.freeCount--;
        this._allocatedBuffers++;
        return buffer;
    }

    /** @internal 接收 AllocatorBuffer.dispose() 的归还请求。 */
    releaseBuffer(buffer: AllocatorBuffer, location: number): void {
        if (!Number.isSafeInteger(location) || location < 0) throw new Error("Invalid Buffer allocation");
        const buffersPerBlock = this.config.buffersPerBlock;
        const blockId = Math.floor(location / buffersPerBlock);
        const bufferIndex = location - blockId * buffersPerBlock;
        const block = this._blocks.get(blockId);
        if (!block || bufferIndex < 0 || bufferIndex >= buffersPerBlock) {
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
        const { blockByteLength, bufferByteLength, buffersPerBlock } = this.config;
        const bufferCapacity = blockCount * buffersPerBlock;
        return {
            blockCount,
            bufferCapacity,
            allocatedBuffers: this._allocatedBuffers,
            freeBuffers: bufferCapacity - this._allocatedBuffers,
            reservedBytes: blockCount * blockByteLength,
            allocatedBytes: this._allocatedBuffers * bufferByteLength,
        };
    }

    /** 释放全部空 Block，并返回释放的 Block 数量。 */
    trim(): number {
        const emptyIds = new Set<number>();
        for (const block of this._blocks.values()) {
            if (block.freeCount === this.config.buffersPerBlock) emptyIds.add(block.id);
        }
        for (const id of emptyIds) this._blocks.delete(id);
        if (emptyIds.size > 0) {
            let write = 0;
            for (let i = 0; i < this._freeList.length; i++) {
                const entry = this._freeList[i];
                const blockId = Math.floor(entry / this.config.buffersPerBlock);
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
        this._nextBlockId = 0;
    }

    private grow(): void {
        const id = this._nextBlockId++;
        const { blockByteLength, buffersPerBlock } = this.config;
        if (id > Math.floor(Number.MAX_SAFE_INTEGER / buffersPerBlock) - 1) {
            throw new RangeError("Allocator block id capacity exceeded");
        }
        const block: MemoryBlock = {
            id,
            source: new ArrayBuffer(blockByteLength),
            active: new Array<AllocatorBuffer | undefined>(buffersPerBlock),
            freeCount: buffersPerBlock,
        };
        this._blocks.set(id, block);
        for (let i = buffersPerBlock - 1; i >= 0; i--) {
            this._freeList.push(id * buffersPerBlock + i);
        }
    }
}

function normalizeConfig(config: Readonly<AllocatorOptions>): Readonly<AllocatorConfig> {
    const { bufferByteLength, blockByteLength } = config;
    requirePositiveSafeInteger("bufferByteLength", bufferByteLength);
    requirePositiveSafeInteger("blockByteLength", blockByteLength);
    if (bufferByteLength % Uint32Array.BYTES_PER_ELEMENT !== 0) {
        throw new RangeError("bufferByteLength must be divisible by 4 for TypedArray alignment");
    }
    if (blockByteLength < bufferByteLength || blockByteLength % bufferByteLength !== 0) {
        throw new RangeError("blockByteLength must be an integer multiple of bufferByteLength");
    }
    const buffersPerBlock = blockByteLength / bufferByteLength;
    if (buffersPerBlock > 0xFFFFFFFF) {
        throw new RangeError("buffersPerBlock exceeds the maximum JavaScript array length");
    }
    return Object.freeze({ bufferByteLength, blockByteLength, buffersPerBlock });
}

function requirePositiveSafeInteger(name: string, value: number): void {
    if (!Number.isSafeInteger(value) || value <= 0) {
        throw new RangeError(`${name} must be a positive safe integer`);
    }
}
