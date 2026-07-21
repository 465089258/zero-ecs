import { byteSizeOf, createTypedArray, type EntityArray, type TypedArrayFor, Types } from "../typed-array";

function alignUp(value: number, alignment: number): number {
    return Math.ceil(value / alignment) * alignment;
}

/**
 * 可顺序分配 TypedArray 的 ArrayBuffer 区域包装。
 *
 * Buffer 不依赖 Allocator，也不拥有外部 ArrayBuffer 的生命周期。`dispose()` 只解除
 * 当前包装器对内存区域的引用；此前创建的原生 TypedArray 仍遵循 JavaScript 自身的
 * 引用语义。Allocator 可以通过内部子类覆盖 dispose，实现归还池化内存。
 */
export class Buffer {
    private _source: ArrayBuffer | undefined;
    private _baseOffset: number;
    private _byteLength: number;
    private _offset = 0;

    /** 包装 ArrayBuffer 的全部或指定字节区域。 */
    constructor(
        source: ArrayBuffer,
        byteOffset = 0,
        byteLength = source.byteLength - byteOffset,
    ) {
        if (!(source instanceof ArrayBuffer)) throw new TypeError("Buffer source must be an ArrayBuffer");
        if (!Number.isSafeInteger(byteOffset) || byteOffset < 0) {
            throw new RangeError("byteOffset must be a non-negative safe integer");
        }
        if (!Number.isSafeInteger(byteLength) || byteLength < 0) {
            throw new RangeError("byteLength must be a non-negative safe integer");
        }
        const end = byteOffset + byteLength;
        if (!Number.isSafeInteger(end) || end > source.byteLength) {
            throw new RangeError("Buffer region is outside the source ArrayBuffer");
        }
        this._source = source;
        this._baseOffset = byteOffset;
        this._byteLength = byteLength;
    }

    /** Buffer 区域的可用字节数；dispose 后为 0。 */
    get byteLength(): number { return this._source === undefined ? 0 : this._byteLength; }

    /** 已顺序分配的字节数；dispose 后为 0。 */
    get used(): number { return this._source === undefined ? 0 : this._offset; }

    /** 剩余可分配字节数；dispose 后为 0。 */
    get remaining(): number { return this._source === undefined ? 0 : this._byteLength - this._offset; }

    /** 当前包装器是否已经解除内存引用。 */
    get disposed(): boolean { return this._source === undefined; }

    /**
     * 按元素类型和数量顺序分配 TypedArray。
     * 分配位置会按底层 ArrayBuffer 的绝对字节偏移自动对齐。
     */
    alloc<T extends Types>(type: T, length: number): TypedArrayFor<T> {
        const source = this.requireSource();
        if (!Number.isSafeInteger(length) || length < 0) {
            throw new RangeError(`Buffer.alloc: length must be a non-negative safe integer, got ${length}`);
        }

        const bytesPerElement = byteSizeOf(type);
        const absoluteOffset = alignUp(this._baseOffset + this._offset, bytesPerElement);
        const offset = absoluteOffset - this._baseOffset;
        const byteLength = bytesPerElement * length;
        const end = offset + byteLength;
        if (!Number.isSafeInteger(end) || end > this._byteLength) {
            throw new RangeError(
                `Buffer overflow: cannot allocate ${length} elements (${byteLength} bytes), remaining ${this.remaining} bytes`,
            );
        }

        const view = createTypedArray(type, source, absoluteOffset, length);
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
    /** 分配以 Uint32Array 为物理存储的实体引用列。 */
    entity(length: number): EntityArray { return this.alloc(Types.Entity, length); }

    /** 将整个包装区域清零，不改变当前分配位置。 */
    zero(): void {
        new Uint8Array(this.requireSource(), this._baseOffset, this._byteLength).fill(0);
    }

    /** 解除当前包装器对 ArrayBuffer 区域的引用。 */
    dispose(): void {
        this.requireSource();
        this.detach();
    }

    /** @internal 供拥有实际回收协议的子类在完成回收后解除引用。 */
    protected detach(): void {
        this._source = undefined;
        this._baseOffset = 0;
        this._byteLength = 0;
        this._offset = 0;
    }

    private requireSource(): ArrayBuffer {
        const source = this._source;
        if (source === undefined) throw new Error("Buffer has been disposed");
        return source;
    }
}
