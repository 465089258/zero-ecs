import { describe, expect, test } from "@rstest/core";
import {
    Allocator,
    Buffer,
    DataSet,
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
        expect(() => buffer.dispose()).not.toThrow();
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
        expect(() => buffer.dispose()).not.toThrow();
        const replacement = allocator.alloc();
        expect(replacement).not.toBe(buffer);
        replacement.dispose();
    });

    test("resets Block identity after a successful clear", () => {
        const allocator = new Allocator({ bufferByteLength: 16, blockByteLength: 32 });
        const buffer = allocator.alloc();
        buffer.dispose();
        allocator.clear();

        expect((allocator as unknown as { _nextBlockId: number })._nextBlockId).toBe(0);
        const replacement = allocator.alloc();
        expect((allocator as unknown as { _nextBlockId: number })._nextBlockId).toBe(1);
        replacement.dispose();
        allocator.clear();
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
        const table = data.push();
        expect(table.columns[0]).toBeInstanceOf(Uint32Array);
        expect(table.columns[1]).toBeInstanceOf(Float32Array);
        expect(table.columns[2]).toBeInstanceOf(Int16Array);
        expect(table.id).toBe(0);
        expect(data.at(0)).toBe(table);
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
        expect(data.layout.byteLength).toBe(1024);
        expect(data.allocatedBytes).toBe(0);
        data.push();
        data.push();
        expect(data.tables).toHaveLength(2);
        expect(data.tables[0].byteLength).toBe(1024);
        expect(data.allocatedBytes).toBe(2048);
        data.dispose();
        expect(data.allocatedBytes).toBe(0);
        allocator.trim();
        allocator.clear();
    });

    test("uses push/pop and reuses the continuous tail Table ID", () => {
        const allocator = new Allocator({ bufferByteLength: 16, blockByteLength: 64 });
        const data = new DataSet(allocator, [Types.U32] as const);
        expect(data.push().id).toBe(0);
        expect(data.push().id).toBe(1);
        expect(data.length).toBe(2);
        expect(data.pop()).toBe(true);
        expect(data.length).toBe(1);
        expect(data.push().id).toBe(1);
        expect(data.pop()).toBe(true);
        expect(data.pop()).toBe(true);
        expect(data.pop()).toBe(false);
        data.dispose();
    });

    test("keeps row state out of Table while providing data operations", () => {
        const allocator = new Allocator();
        const data = new DataSet(allocator, [Types.U32, Types.F32] as const);
        const source = data.push();
        const target = data.push();

        source.set(0, 0, 42);
        source.set(0, 1, 2.5);
        source.copyRowTo(0, target, 1);
        expect(target.get(1, 0)).toBe(42);
        expect(target.get(1, 1)).toBe(2.5);

        target.clearRow(1);
        expect(target.get(1, 0)).toBe(0);
        expect(target.get(1, 1)).toBe(0);
        expect("count" in target).toBe(false);
        expect("allocRow" in target).toBe(false);
        expect("popRow" in target).toBe(false);
        data.dispose();
    });
});
