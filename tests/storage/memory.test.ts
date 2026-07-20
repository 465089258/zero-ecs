import { describe, expect, test } from "@rstest/core";
import {
    Allocator,
    Buffer,
    DataSet,
    INVALID_DATA_ROW,
    RemoveResult,
    Types,
    createTableLayout,
    defaultAllocatorConfig,
} from "@zero-ecs/world/advanced";

describe("Allocator", () => {
    test("uses the default 2 MiB / 16 KiB allocation scheme", () => {
        const allocator = new Allocator();
        const { blockByteLength, bufferByteLength, buffersPerBlock } = defaultAllocatorConfig;
        const buffers = Array.from({ length: buffersPerBlock }, () => allocator.alloc());
        const views = buffers.map(buffer => buffer.u8(1));
        expect(new Set(views.map(view => view.buffer)).size).toBe(1);
        expect(allocator.config).toEqual(defaultAllocatorConfig);
        expect(Object.isFrozen(allocator.config)).toBe(true);
        expect(buffers[0].byteLength).toBe(bufferByteLength);
        expect(allocator.stats()).toEqual({
            blockCount: 1,
            bufferCapacity: buffersPerBlock,
            allocatedBuffers: buffersPerBlock,
            freeBuffers: 0,
            reservedBytes: blockByteLength,
            allocatedBytes: blockByteLength,
        });
        const overflow = allocator.alloc();
        expect(allocator.stats().blockCount).toBe(2);
        overflow.dispose();
        for (const buffer of buffers) buffer.dispose();
    });

    test("supports independent custom allocation schemes", () => {
        const small = new Allocator({
            bufferByteLength: 4 * 1024,
            blockByteLength: 32 * 1024,
        });
        const defaults = new Allocator();
        const buffers = Array.from({ length: 8 }, () => small.alloc());

        expect(small.config).toEqual({
            bufferByteLength: 4 * 1024,
            blockByteLength: 32 * 1024,
            buffersPerBlock: 8,
        });
        expect(defaults.config).toEqual(defaultAllocatorConfig);
        expect(buffers.every(buffer => buffer.byteLength === 4 * 1024)).toBe(true);
        expect(small.stats()).toEqual({
            blockCount: 1,
            bufferCapacity: 8,
            allocatedBuffers: 8,
            freeBuffers: 0,
            reservedBytes: 32 * 1024,
            allocatedBytes: 32 * 1024,
        });
        const overflow = small.alloc();
        expect(small.stats().blockCount).toBe(2);
        overflow.dispose();
        for (const buffer of buffers) buffer.dispose();
        small.trim();
        small.clear();
    });

    test("rejects invalid allocation schemes during construction", () => {
        expect(() => new Allocator({ bufferByteLength: 0, blockByteLength: 1024 })).toThrow(/positive/);
        expect(() => new Allocator({ bufferByteLength: 1025, blockByteLength: 4100 })).toThrow(/divisible by 4/);
        expect(() => new Allocator({ bufferByteLength: 4096, blockByteLength: 5000 })).toThrow(/integer multiple/);
        expect(() => new Allocator({ bufferByteLength: 8192, blockByteLength: 4096 })).toThrow(/integer multiple/);
    });

    test("wraps an ArrayBuffer without depending on Allocator", () => {
        const source = new ArrayBuffer(64);
        const buffer = new Buffer(source, 1, 63);
        const byte = buffer.u8(1);
        const value = buffer.f32(1);

        expect(byte.byteOffset).toBe(1);
        expect(value.byteOffset).toBe(4);
        value[0] = 42;
        buffer.dispose();

        expect(buffer.disposed).toBe(true);
        expect(buffer.byteLength).toBe(0);
        expect(value[0]).toBe(42);
        expect(() => buffer.u8(1)).toThrow(/disposed/);
        expect(() => buffer.dispose()).toThrow(/disposed/);
    });

    test("returns an allocated Buffer to its Allocator on dispose", () => {
        const allocator = new Allocator();
        const buffer = allocator.alloc();
        expect(buffer).toBeInstanceOf(Buffer);
        expect(allocator.stats().allocatedBuffers).toBe(1);
        buffer.dispose();
        expect(buffer.byteLength).toBe(0);
        expect(buffer.disposed).toBe(true);
        expect(allocator.stats().allocatedBuffers).toBe(0);
        expect(() => buffer.u8(1)).toThrow();
        expect(() => buffer.dispose()).toThrow();
        const replacement = allocator.alloc();
        expect(replacement).not.toBe(buffer);
        replacement.dispose();
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
        buffer.dispose();
    });
});

describe("DataSet", () => {
    test("builds aligned typed-array columns inside one Buffer", () => {
        const allocator = new Allocator();
        const data = new DataSet(allocator, [Types.U32, Types.F32, Types.I16] as const);
        const row = data.insert();
        const table = data.table(data.tableIdOf(row))!;
        expect(table.columns[0]).toBeInstanceOf(Uint32Array);
        expect(table.columns[1]).toBeInstanceOf(Float32Array);
        expect(table.columns[2]).toBeInstanceOf(Int16Array);
        expect(data.layout.usedBytes).toBeLessThanOrEqual(defaultAllocatorConfig.bufferByteLength);
        data.dispose();
        expect(allocator.stats().allocatedBuffers).toBe(0);
    });

    test("derives Table capacity from the allocator Buffer size", () => {
        const allocator = new Allocator({
            bufferByteLength: 1024,
            blockByteLength: 8 * 1024,
        });
        const data = new DataSet(allocator, [Types.U32, Types.F32] as const);
        expect(data.layout).toEqual(createTableLayout([Types.U32, Types.F32], 1024));
        for (let i = 0; i <= data.layout.capacity; i++) data.insert();
        expect(data.tables).toHaveLength(2);
        expect(data.tables[0].byteLength).toBe(1024);
        data.dispose();
        allocator.trim();
        allocator.clear();
    });

    test("encodes every emitted DataRow as an exact U32 value", () => {
        const allocator = new Allocator({ bufferByteLength: 64, blockByteLength: 256 });
        const data = new DataSet(allocator, [Types.U8] as const);
        let location = data.insert();
        for (let i = 1; i <= data.layout.capacity; i++) location = data.insert();

        expect(data.tableIdOf(location)).toBe(1);
        expect(data.rowIndexOf(location)).toBe(0);
        expect(new Uint32Array([location])[0]).toBe(location);
        expect(INVALID_DATA_ROW).toBe(0xFFFFFFFF);
        expect(data.valid(INVALID_DATA_ROW)).toBe(false);
        data.dispose();
    });

    test("reuses released Table IDs within the U32 address space", () => {
        const allocator = new Allocator({ bufferByteLength: 16, blockByteLength: 64 });
        const data = new DataSet(allocator, [Types.U32] as const, { retainEmptyTables: 0 });
        const rows = Array.from({ length: data.layout.capacity + 1 }, () => data.insert());
        const releasedLocation = rows[rows.length - 1];

        expect(data.tableIdOf(releasedLocation)).toBe(1);
        expect(data.remove(releasedLocation)).toBe(RemoveResult.Removed);
        expect(data.tables).toHaveLength(1);

        const reusedLocation = data.insert();
        expect(data.tableIdOf(reusedLocation)).toBe(1);
        expect(data.rowIndexOf(reusedLocation)).toBe(0);
        expect(reusedLocation).toBe(releasedLocation);
        expect(new Uint32Array([reusedLocation])[0]).toBe(reusedLocation);
        data.dispose();
    });

    test("uses dense tables and reports swap-remove relocation", () => {
        const allocator = new Allocator();
        const capacity = createTableLayout(
            [Types.U32],
            allocator.config.bufferByteLength,
        ).capacity;
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
