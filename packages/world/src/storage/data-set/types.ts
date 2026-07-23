import { Types } from "../typed-array";

/** 单列在 Table Buffer 中的内存布局。 */
export interface ColumnLayout {
    readonly index: number;
    readonly type: Types;
    readonly byteOffset: number;
    readonly byteLength: number;
    readonly bytesPerElement: number;
}

/** 一个固定大小 Table Buffer 的容量与列布局。 */
export interface TableLayout {
    readonly capacity: number;
    readonly columns: readonly ColumnLayout[];
    readonly usedBytes: number;
    readonly unusedBytes: number;
}
