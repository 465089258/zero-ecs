import type { Entity } from "../entity/entity";

/** ECS 列支持的数值存储类型。 */
export const Types = Object.freeze({
    I8: 0,
    U8: 1,
    U8C: 2,
    I16: 3,
    U16: 4,
    I32: 5,
    U32: 6,
    F32: 7,
    /** 以 Uint32 存储、在类型层表示为 Entity 的实体引用。 */
    Entity: 8,
} as const);

export type Types = (typeof Types)[keyof typeof Types];

export type U8 = typeof Types.U8;
export type I8 = typeof Types.I8;
export type U8C = typeof Types.U8C;
export type U16 = typeof Types.U16;
export type I16 = typeof Types.I16;
export type U32 = typeof Types.U32;
export type I32 = typeof Types.I32;
export type F32 = typeof Types.F32;
export type E32 = typeof Types.Entity;

const BYTES: { [K in Types]: number } = [1, 1, 1, 2, 2, 4, 4, 4, 4] as const;
// 对应每个类型的元素字节数
type TypedArrayCtor = new (buffer: ArrayBuffer, offset: number, length: number) => TypedArray;
// 类型 → 构造函数 + 字节数
const CTORS: readonly TypedArrayCtor[] = [Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Uint32Array];

/** Uint32 物理存储上的实体引用列。 */
export interface EntityArray extends Uint32Array {
    [index: number]: Entity;
}

/** 将 {@link Types} 映射为对应的 TypedArray 类型。 */
export type TypedArrayFor<T extends Types> =
    T extends typeof Types.I8 ? Int8Array :
    T extends typeof Types.U8 ? Uint8Array :
    T extends typeof Types.U8C ? Uint8ClampedArray :
    T extends typeof Types.I16 ? Int16Array :
    T extends typeof Types.U16 ? Uint16Array :
    T extends typeof Types.I32 ? Int32Array :
    T extends typeof Types.U32 ? Uint32Array :
    T extends typeof Types.F32 ? Float32Array :
    T extends typeof Types.Entity ? EntityArray :
    never;

/** 将存储类型映射为单个字段读取或写入时的值类型。 */
export type StoredValueFor<T extends Types> = T extends typeof Types.Entity ? Entity : number;

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

