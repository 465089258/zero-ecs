import { byteSizeOf, createTypedArray, type TypedArrayFor, Types } from "../typed-array";
import { BUFFER_SIZE } from "./constants";

/** Buffer 归还时与 Allocator 通信的内部边界。 */
interface BufferOwner {
    releaseBuffer(buffer: Buffer, location: number): void;
}

function alignUp(value: number, alignment: number): number {
    return Math.ceil(value / alignment) * alignment;
}

/**
 * 由 {@link Allocator} 分配的固定 16 KiB 内存区域。
 *
 * Buffer 只提供 TypedArray 分配与显式释放能力，不暴露底层
 * 2 MiB Block、ArrayBuffer 或字节偏移。
 */
export class Buffer {
    private _source: ArrayBuffer | undefined;
    private _owner: BufferOwner | undefined;
    private _baseOffset = 0;
    private _offset = 0;
    private _location = -1;

    private constructor(source: ArrayBuffer, baseOffset: number, location: number, owner: BufferOwner) {
        this._source = source;
        this._baseOffset = baseOffset;
        this._location = location;
        this._owner = owner;
    }

    /** @internal 仅供 Allocator 创建 Buffer 租约对象。 */
    static create(source: ArrayBuffer, baseOffset: number, location: number, owner: BufferOwner): Buffer {
        return new Buffer(source, baseOffset, location, owner);
    }

    /** Buffer 的可用字节数；释放后为 0。 */
    get byteLength(): number { return this._source === undefined ? 0 : BUFFER_SIZE; }

    /** 已分配的字节数；释放后为 0。 */
    get used(): number { return this._source === undefined ? 0 : this._offset; }

    /** 剩余可分配字节数；释放后为 0。 */
    get remaining(): number { return this._source === undefined ? 0 : BUFFER_SIZE - this._offset; }

    /** Buffer 是否已归还给 Allocator。 */
    get released(): boolean { return this._source === undefined; }

    /**
     * 按元素类型和数量顺序分配 TypedArray。
     * 分配位置会自动满足目标 TypedArray 的对齐要求。
     */
    alloc<T extends Types>(type: T, length: number): TypedArrayFor<T> {
        const source = this.requireSource();
        if (!Number.isSafeInteger(length) || length < 0) {
            throw new RangeError(`Buffer.alloc: length must be a non-negative safe integer, got ${length}`);
        }

        const bytesPerElement = byteSizeOf(type);
        const offset = alignUp(this._offset, bytesPerElement);
        const byteLength = bytesPerElement * length;
        const end = offset + byteLength;
        if (!Number.isSafeInteger(end) || end > BUFFER_SIZE) {
            throw new RangeError(
                `Buffer overflow: cannot allocate ${length} elements (${byteLength} bytes), remaining ${this.remaining} bytes`,
            );
        }

        const view = createTypedArray(type, source, this._baseOffset + offset, length);
        this._offset = end;
        return view;
    }

    /** 分配 Int8Array。 */
    i8(length: number): Int8Array { return this.alloc(Types.I8, length); }
    /** 分配 Uint8Array。 */
    u8(length: number): Uint8Array { return this.alloc(Types.U8, length); }
    /** 分配 Uint8ClampedArray。 */
    u8c(length: number): Uint8ClampedArray { return this.alloc(Types.U8C, length); }
    /** 分配 Int16Array。 */
    i16(length: number): Int16Array { return this.alloc(Types.I16, length); }
    /** 分配 Uint16Array。 */
    u16(length: number): Uint16Array { return this.alloc(Types.U16, length); }
    /** 分配 Int32Array。 */
    i32(length: number): Int32Array { return this.alloc(Types.I32, length); }
    /** 分配 Uint32Array。 */
    u32(length: number): Uint32Array { return this.alloc(Types.U32, length); }
    /** 分配 Float32Array。 */
    f32(length: number): Float32Array { return this.alloc(Types.F32, length); }

    /** 将整个 16 KiB 区域清零，不改变当前分配位置。 */
    zero(): void {
        new Uint8Array(this.requireSource(), this._baseOffset, BUFFER_SIZE).fill(0);
    }

    /**
     * 将 Buffer 归还给所属 Allocator，并清除对底层内存的引用。
     * 释放后继续调用数组分配或清零 API 会抛出错误。
     * 调用方也不得再使用此前分配的 TypedArray，原生视图无法被 JavaScript 强制撤销。
     */
    release(): void {
        const owner = this._owner;
        if (owner === undefined) throw new Error("Buffer has already been released");
        owner.releaseBuffer(this, this._location);
        this._source = undefined;
        this._owner = undefined;
        this._baseOffset = 0;
        this._offset = 0;
        this._location = -1;
    }

    private requireSource(): ArrayBuffer {
        const source = this._source;
        if (source === undefined) throw new Error("Buffer has been released");
        return source;
    }
}


