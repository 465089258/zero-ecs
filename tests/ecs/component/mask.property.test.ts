import { describe, expect, test } from "@rstest/core";
import { Mask } from "@zero-ecs/game/advanced";

function createRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state;
    };
}

function createSet(random: () => number, bitCount: number): Set<number> {
    const result = new Set<number>();
    for (let bit = 0; bit < bitCount; bit++) {
        if ((random() & 3) === 0) result.add(bit);
    }
    return result;
}

function fromSet(bits: ReadonlySet<number>): Mask {
    const result = Mask.empty();
    for (const bit of bits) result.orInto(Mask.fromBit(bit));
    return result;
}

function union(a: ReadonlySet<number>, b: ReadonlySet<number>): Set<number> {
    return new Set([...a, ...b]);
}

function intersection(a: ReadonlySet<number>, b: ReadonlySet<number>): Set<number> {
    const result = new Set<number>();
    for (const bit of a) if (b.has(bit)) result.add(bit);
    return result;
}

function difference(a: ReadonlySet<number>, b: ReadonlySet<number>): Set<number> {
    const result = new Set<number>();
    for (const bit of a) if (!b.has(bit)) result.add(bit);
    return result;
}

function symmetricDifference(a: ReadonlySet<number>, b: ReadonlySet<number>): Set<number> {
    return union(difference(a, b), difference(b, a));
}

function expectBits(mask: Mask, expected: ReadonlySet<number>, bitCount: number): void {
    const words = mask.words;
    for (let bit = 0; bit < bitCount; bit++) {
        const present = ((words[bit >>> 5] ?? 0) & (1 << (bit & 31))) !== 0;
        expect(present).toBe(expected.has(bit));
    }
    let highest = -1;
    for (const bit of expected) if (bit > highest) highest = bit;
    expect(mask.length).toBe(highest + 1);
}

function referenceCompare(a: Mask, b: Mask): number {
    const aw = a.words;
    const bw = b.words;
    for (let i = Math.max(aw.length, bw.length) - 1; i >= 0; i--) {
        const av = aw[i] ?? 0;
        const bv = bw[i] ?? 0;
        if (av !== bv) return av < bv ? -1 : 1;
    }
    return 0;
}

describe("Mask properties", () => {
    test("matches a Set model across word boundaries", () => {
        const random = createRandom(0xC0FFEE);
        const bitCount = 193;

        for (let iteration = 0; iteration < 300; iteration++) {
            const a = createSet(random, bitCount);
            const b = createSet(random, bitCount);
            const am = fromSet(a);
            const bm = fromSet(b);

            expectBits(am.or(bm), union(a, b), bitCount);
            expectBits(am.and(bm), intersection(a, b), bitCount);
            expectBits(am.clone().xorInto(bm), symmetricDifference(a, b), bitCount);
            expectBits(am.clone().andNotInto(bm), difference(a, b), bitCount);

            expect(am.has(bm)).toBe([...b].every(bit => a.has(bit)));
            expect(am.not(bm)).toBe([...a].every(bit => !b.has(bit)));
            expect(am.compare(bm)).toBe(referenceCompare(am, bm));
            expect(am.equals(bm)).toBe(a.size === b.size && [...a].every(bit => b.has(bit)));

            const copy = Mask.empty();
            am.copyTo(copy);
            expectBits(copy, a, bitCount);
            copy.toZero();
            expectBits(copy, new Set(), bitCount);
        }
    });

    test("fills inclusive ranges and rejects invalid bit indexes", () => {
        for (const lastBit of [0, 31, 32, 95]) {
            const expected = new Set<number>();
            for (let bit = 0; bit <= lastBit; bit++) expected.add(bit);
            expectBits(Mask.fill(lastBit), expected, lastBit + 2);
        }

        expect(() => Mask.fromBit(-1)).toThrow(/Mask bit/);
        expect(() => Mask.fill(1.5)).toThrow(/Mask bit/);
        expect(() => Mask.fromBit(Number.NaN)).toThrow(/Mask bit/);
    });
});
