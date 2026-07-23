import { byteSizeOf, Types } from "../typed-array";
import { ColumnLayout, TableLayout } from "./types";

function alignUp(value: number, alignment: number): number {
    return Math.ceil(value / alignment) * alignment;
}

function calculateUsedBytes(types: readonly Types[], capacity: number): number {
    let offset = 0;
    for (const type of types) {
        const bytes = byteSizeOf(type);
        offset = alignUp(offset, bytes) + bytes * capacity;
    }
    return offset;
}

/** 计算一组 TypedArray 列在固定 Buffer 中的最大容量与内存布局。 */
export function createTableLayout(types: readonly Types[], bufferByteLength: number): TableLayout {
    if (types.length === 0) throw new Error("DataSet requires at least one column");
    if (!Number.isInteger(bufferByteLength) || bufferByteLength <= 0) {
        throw new RangeError("bufferByteLength must be a positive integer");
    }
    let bytesPerRow = 0;
    for (const type of types) bytesPerRow += byteSizeOf(type);
    let low = 1;
    let high = Math.floor(bufferByteLength / bytesPerRow);
    let capacity = 0;
    while (low <= high) {
        const middle = (low + high) >>> 1;
        if (calculateUsedBytes(types, middle) <= bufferByteLength) {
            capacity = middle;
            low = middle + 1;
        } else {
            high = middle - 1;
        }
    }
    if (capacity === 0) {
        throw new RangeError(`DataSet row cannot fit into a ${bufferByteLength}-byte Buffer`);
    }
    const columns: ColumnLayout[] = [];
    let offset = 0;
    for (let index = 0; index < types.length; index++) {
        const type = types[index];
        const bytesPerElement = byteSizeOf(type);
        offset = alignUp(offset, bytesPerElement);
        const byteLength = bytesPerElement * capacity;
        columns.push({ index, type, byteOffset: offset, byteLength, bytesPerElement });
        offset += byteLength;
    }
    return {
        byteLength: bufferByteLength,
        capacity,
        columns,
        usedBytes: offset,
        unusedBytes: bufferByteLength - offset,
    };
}
