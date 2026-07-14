function allocateBuffer(size: number): ArrayBuffer {
    return new ArrayBuffer(size);
}

/** ECS 列支持的数值存储类型。 */
export const enum Types { I8, U8, U8C, I16, U16, I32, U32, F32 }
const BYTES: { [K in Types]: number } = [1, 1, 1, 2, 2, 4, 4, 4] as const;
// 对应每个类型的元素字节数
type TypedArrayCtor<T extends Types> = new (buffer: ArrayBuffer, offset: number, length: number) => TypedArrayFor<T>;
// 类型 → 构造函数 + 字节数
const CTORS: { [K in Types]: TypedArrayCtor<K> } = [Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array];

/** 将 {@link Types} 映射为对应的 TypedArray 类型。 */
export type TypedArrayFor<T extends Types> =
    T extends Types.I8 ? Int8Array :
    T extends Types.U8 ? Uint8Array :
    T extends Types.U8C ? Uint8ClampedArray :
    T extends Types.I16 ? Int16Array :
    T extends Types.U16 ? Uint16Array :
    T extends Types.I32 ? Int32Array :
    T extends Types.U32 ? Uint32Array :
    T extends Types.F32 ? Float32Array :
    never;

/** ECS 存储支持的 TypedArray 联合类型。 */
export type TypedArray = Int8Array | Uint8Array | Uint8ClampedArray | Int16Array | Uint16Array | Int32Array | Uint32Array | Float32Array;

/** 返回指定存储类型中单个元素占用的字节数。 */
export function byteSizeOf(type: Types): number {
    const bytes = BYTES[type];
    if (bytes === undefined) throw new RangeError(`Unknown buffer type: ${type}`);
    return bytes;
}

/** 在已有 ArrayBuffer 的指定区域创建 TypedArray 视图。 */
export function createTypedArray<T extends Types>(type: T, buffer: ArrayBuffer, byteOffset: number, length: number): TypedArrayFor<T> {
    const Ctor = CTORS[type];
    if (Ctor === undefined) throw new RangeError(`Unknown buffer type: ${type}`);
    return new Ctor(buffer, byteOffset, length) as TypedArrayFor<T>;
}

/** 在预分配 ArrayBuffer 中按顺序切分 TypedArray 的线性缓冲区。 */
export class Buffer {
    private readonly _buffer: ArrayBuffer;
    private _offset: number = 0;
    private _totalBytes: number;

    /** 创建指定字节容量的缓冲区。 */
    constructor(totalBytes: number) {
        this._totalBytes = totalBytes;
        this._buffer = allocateBuffer(totalBytes);
    }

    /** 底层 ArrayBuffer。 */
    get buffer(): ArrayBuffer { return this._buffer; }
    /** 下一次分配的字节偏移。 */
    get offset(): number { return this._offset; }
    /** 剩余可分配字节数。 */
    get remaining(): number { return this._totalBytes - this._offset; }

    /** 重置分配位置，但不清除底层数据。 */
    reset(): void {
        this._offset = 0;
    }

    /** 按元素类型和数量分配一个 TypedArray 视图。 */
    alloc<T extends Types>(type: T, length: number): TypedArrayFor<T> {
        if (length < 0) throw new RangeError(`Buffer.alloc: length must be >= 0, got ${length}`);
        if (length === 0) return new CTORS[type](this._buffer, this._offset, 0) as TypedArrayFor<T>;
        const bytesLength = Buffer.byteSizeOfArray(type, length);
        const offset = this._offset;
        if (offset + bytesLength > this._totalBytes) {
            throw new RangeError(
                `Buffer overflow: cannot allocate ${length} elements (${bytesLength} bytes), remaining ${this.remaining} bytes`
            );
        }
        const view = new CTORS[type](this._buffer, offset, length);
        this._offset = offset + bytesLength;
        return view;
    }
    /** 返回指定数组按 4 字节对齐后的占用字节数。 */
    static byteSizeOfArray(type: Types, length: number): number {
        const bytes = BYTES[type];
        const byteLength = bytes * length;
        return Math.ceil(byteLength / 4) * 4;
    }
    /** 返回指定存储类型中单个元素的字节数。 */
    static byteSizeOf(type: Types): number {
        return byteSizeOf(type);
    }
}

