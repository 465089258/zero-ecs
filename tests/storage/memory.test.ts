import { describe, expect, test } from "@rstest/core";
import {
    BLOCK_SIZE,
    BUFFERS_PER_BLOCK,
    BUFFER_SIZE,
    Allocator,
    DataSet,
    RemoveResult,
    Types,
    createTableLayout,
    dataRowTableId,
} from "../../src/advanced";

describe("Allocator", () => {
    test("splits a 2 MiB block into 128 16 KiB Buffers", () => {
        const allocator = new Allocator();
        const buffers = Array.from({ length: BUFFERS_PER_BLOCK }, () => allocator.alloc());
        const views = buffers.map(buffer => buffer.u8(1));
        expect(new Set(views.map(view => view.buffer)).size).toBe(1);
        expect(buffers[0].byteLength).toBe(BUFFER_SIZE);
        expect(allocator.stats()).toEqual({
            blockCount: 1, bufferCapacity: 128, allocatedBuffers: 128, freeBuffers: 0,
            reservedBytes: BLOCK_SIZE, allocatedBytes: BLOCK_SIZE,
        });
        const overflow = allocator.alloc();
        expect(allocator.stats().blockCount).toBe(2);
        overflow.release();
        for (const buffer of buffers) buffer.release();
    });

    test("invalidates a released Buffer and creates a new lease object", () => {
        const allocator = new Allocator();
        const buffer = allocator.alloc();
        buffer.release();
        expect(buffer.byteLength).toBe(0);
        expect(buffer.released).toBe(true);
        expect(() => buffer.u8(1)).toThrow();
        expect(() => buffer.release()).toThrow();
        const replacement = allocator.alloc();
        expect(replacement).not.toBe(buffer);
        replacement.release();
    });

    test("allocates aligned TypedArrays without exposing the raw region", () => {
        const allocator = new Allocator();
        const buffer = allocator.alloc();
        const bytes = buffer.u8(3);
        const values = buffer.f32(2);
        expect(bytes.byteOffset + bytes.byteLength).toBeLessThanOrEqual(values.byteOffset);
        expect(values.byteOffset % Float32Array.BYTES_PER_ELEMENT).toBe(0);
        expect(buffer.used).toBe(12);
        expect("buffer" in buffer).toBe(false);
        buffer.release();
    });
});

describe("DataSet", () => {
    test("builds aligned typed-array columns inside one Buffer", () => {
        const allocator = new Allocator();
        const data = new DataSet(allocator, [Types.U32, Types.F32, Types.I16] as const);
        const row = data.insert();
        const table = data.table(dataRowTableId(row))!;
        expect(table.columns[0]).toBeInstanceOf(Uint32Array);
        expect(table.columns[1]).toBeInstanceOf(Float32Array);
        expect(table.columns[2]).toBeInstanceOf(Int16Array);
        expect(data.layout.usedBytes).toBeLessThanOrEqual(BUFFER_SIZE);
        data.dispose();
        expect(allocator.stats().allocatedBuffers).toBe(0);
    });

    test("uses dense tables and reports swap-remove relocation", () => {
        const allocator = new Allocator();
        const capacity = createTableLayout([Types.U32]).capacity;
        const data = new DataSet(allocator, [Types.U32] as const);
        const rows = Array.from({ length: capacity + 1 }, (_, value) => {
            const row = data.insert(); data.set(row, 0, value + 1); return row;
        });
        expect(data.tables).toHaveLength(2);
        expect(data.remove(rows[rows.length - 1])).toBe(RemoveResult.Removed);
        expect(data.tables).toHaveLength(2);
        expect(data.tables[1].empty).toBe(true);
        const result = data.remove(rows[0]);
        expect(result).toBe(RemoveResult.Moved);
        expect(data.get(rows[0], 0)).toBe(rows.length - 1);
        expect(data.count).toBe(rows.length - 2);
    });
});
