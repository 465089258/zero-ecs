/**
 * Buffer 用于把多个分散的TypedArray合并为一个ArrayBuffer 中，这样可以增加cpu缓存命中率
 */

/** 内存分配方法，后期如果要做内存大一统可以从这里入手 */
function allocateBuffer(size: number): ArrayBuffer {
    return new ArrayBuffer(size);
}

export const enum Types { I8, U8, U8C, I16, U16, I32, U32, F32 }
const BYTES: { [K in Types]: number } = [1, 1, 1, 2, 2, 4, 4, 4] as const;
// 对应每个类型的元素字节数
type TypedArrayCtor<T extends Types> = new (buffer: ArrayBuffer, offset: number, length: number) => TypedArrayFor<T>;
// 类型 → 构造函数 + 字节数
const CTORS: { [K in Types]: TypedArrayCtor<K> } = [Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array];

// 类型映射：根据 ValueType 推断对应的 TypedArray 子类型
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

export type TypedArray = Int8Array | Uint8Array | Uint8ClampedArray | Int16Array | Uint16Array | Int32Array | Uint32Array | Float32Array;

export function byteSizeOf(type: Types): number {
    const bytes = BYTES[type];
    if (bytes === undefined) throw new RangeError(`Unknown buffer type: ${type}`);
    return bytes;
}

export function createTypedArray<T extends Types>(type: T, buffer: ArrayBuffer, byteOffset: number, length: number): TypedArrayFor<T> {
    const Ctor = CTORS[type];
    if (Ctor === undefined) throw new RangeError(`Unknown buffer type: ${type}`);
    return new Ctor(buffer, byteOffset, length) as TypedArrayFor<T>;
}

/**
 * 线性分配缓冲区
 * 使用预分配的 ArrayBuffer，从中按顺序切分不同类型的 TypedArray。
 */
export class Buffer {
    private readonly _buffer: ArrayBuffer;
    private _offset: number = 0;
    private _totalBytes: number;

    constructor(totalBytes: number) {
        this._totalBytes = totalBytes;
        this._buffer = allocateBuffer(totalBytes);
    }

    get buffer(): ArrayBuffer { return this._buffer; }
    get offset(): number { return this._offset; }
    get remaining(): number { return this._totalBytes - this._offset; }


    reset(): void {
        this._offset = 0;
    }

    /**
    * 通用分配接口
    * @param type  编译期内联的数字枚举（ValueType.I8 等）
    * @param length 元素个数
    */
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
    static byteSizeOfArray(type: Types, length: number): number {
        const bytes = BYTES[type];
        const byteLength = bytes * length;
        return Math.ceil(byteLength / 4) * 4;
    }
    /** 返回某个 ValueType 单元素的字节数 */
    static byteSizeOf(type: Types): number {
        return byteSizeOf(type);
    }
}

