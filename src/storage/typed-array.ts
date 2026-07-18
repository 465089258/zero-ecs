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

