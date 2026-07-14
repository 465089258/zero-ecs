import { describe, expect, test } from "@rstest/core";
import {
    BLOCK_SIZE,
    CHUNKS_PER_BLOCK,
    CHUNK_SIZE,
    ChunkAllocator,
    DataSet,
    RemoveResult,
    Types,
    createTableLayout,
    dataRowTableId,
} from "../../src/advanced";

describe("ChunkAllocator", () => {
    test("splits a 2 MiB block into 128 16 KiB chunks", () => {
        const allocator = new ChunkAllocator();
        const chunks = Array.from({ length: CHUNKS_PER_BLOCK }, () => allocator.alloc());
        expect(new Set(chunks.map(chunk => chunk.buffer)).size).toBe(1);
        expect(chunks[0].byteLength).toBe(CHUNK_SIZE);
        expect(allocator.stats()).toEqual({
            blockCount: 1, chunkCapacity: 128, allocatedChunks: 128, freeChunks: 0,
            reservedBytes: BLOCK_SIZE, allocatedBytes: BLOCK_SIZE,
        });
        expect(allocator.alloc().handle.blockId).toBe(1);
    });

    test("rejects stale and double-freed handles", () => {
        const allocator = new ChunkAllocator();
        const chunk = allocator.alloc();
        allocator.free(chunk.handle);
        expect(allocator.resolve(chunk.handle)).toBeNull();
        expect(() => allocator.free(chunk.handle)).toThrow();
        const replacement = allocator.alloc();
        expect(replacement.handle.generation).toBe(chunk.handle.generation + 1);
    });
});

describe("DataSet", () => {
    test("builds aligned typed-array columns inside one chunk", () => {
        const allocator = new ChunkAllocator();
        const data = new DataSet(allocator, [Types.U32, Types.F32, Types.I16] as const);
        const row = data.insert();
        const table = data.table(dataRowTableId(row))!;
        expect(table.columns[0]).toBeInstanceOf(Uint32Array);
        expect(table.columns[1]).toBeInstanceOf(Float32Array);
        expect(table.columns[2]).toBeInstanceOf(Int16Array);
        expect(data.layout.usedBytes).toBeLessThanOrEqual(CHUNK_SIZE);
        data.dispose();
        expect(allocator.stats().allocatedChunks).toBe(0);
    });

    test("uses dense tables and reports swap-remove relocation", () => {
        const allocator = new ChunkAllocator();
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
