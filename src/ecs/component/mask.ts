export class Mask {
    private _bits: Uint32Array;
    private _length: number; // 有效位数

    private constructor(bits: Uint32Array, length: number) {
        this._bits = bits;
        this._length = length;
    }
    toZeor() {
        this._length = 0;
        this._bits.fill(0);
    }
    /** 创建一个只有第 `bit` 位为 1 的掩码 */
    static fromBit(bit: number): Mask {
        const wordIndex = bit >>> 5;           // 除以 32
        const bitInWord = bit & 31;            // 取余
        const length = bit + 1;
        const bits = new Uint32Array(wordIndex + 1);
        bits[wordIndex] = 1 << bitInWord;
        return new Mask(bits, length);
    }

    /** 空掩码 */
    static empty(): Mask {
        return new Mask(new Uint32Array(0), 0);
    }

    static fill(bit: number): Mask {
        const wordIndex = bit >>> 5;        // 除以 32
        const bitInWord = bit & 31;         // 取余
        const length = bit + 1;             // 有效位数
        const bits = new Uint32Array(wordIndex + 1);
        // 前面的字全部设为 1
        for (let i = 0; i < wordIndex; i++) {
            bits[i] = ~0;
        }
        // 最后一个字只将有效的低位置 1
        if (bitInWord === 31) {
            bits[wordIndex] = ~0;
        } else {
            bits[wordIndex] = (1 << (bitInWord + 1)) - 1;
        }
        return new Mask(bits, length);
    }
    v0() {
        return this._bits[0] ?? 0;
    }
    v1() {
        return this._bits[1] ?? 0;
    }
    v2() {
        return this._bits[2] ?? 0;
    }
    v3() {
        return this._bits[3] ?? 0;
    }

    clone(): Mask {
        return new Mask(new Uint32Array(this._bits), this._length);
    }
    copyTo(target: Mask): void {
        let tBits = target._bits;
        const oBits = this._bits;
        if (tBits.length < oBits.length) {
            tBits = new Uint32Array(oBits.length);
            target._bits = tBits;
        }
        for (let i = 0; i < oBits.length; i++) {
            tBits[i] = oBits[i];
        }
        for (let i = oBits.length; i < tBits.length; i++) {
            tBits[i] = 0;
        }
        target._length = 0;
        for (let i = 0; i < tBits.length; i++) {
            if (tBits[i] !== 0) {
                target._length = Math.max(target._length, (i << 5) + (31 - Math.clz32(tBits[i])) + 1);
            }
        }
    }
    /** 返回当前掩码与 other 的并集（不修改原对象） */
    or(other: Mask): Mask {
        return this.clone().orInto(other);
    }

    /** 返回当前掩码与 other 的交集（不修改原对象） */
    and(other: Mask): Mask {
        return this.clone().andInto(other);
    }

    /** 检查当前掩码是否包含 `other` 的所有位 */
    has(other: Mask): boolean {
        const { _bits: otherBits } = other;
        const { _bits: thisBits } = this;
        const maxWords = Math.max(thisBits.length, otherBits.length);
        for (let i = 0; i < maxWords; i++) {
            const a = i < thisBits.length ? thisBits[i] : 0;
            const b = i < otherBits.length ? otherBits[i] : 0;
            if (((a & b) >>> 0) !== b) return false;
        }
        return true;
    }

    /** 检查当前掩码是否完全不包含 `other` 的位 */
    not(other: Mask): boolean {
        const { _bits: otherBits } = other;
        const { _bits: thisBits } = this;
        const maxWords = Math.max(thisBits.length, otherBits.length);
        for (let i = 0; i < maxWords; i++) {
            const a = i < thisBits.length ? thisBits[i] : 0;
            const b = i < otherBits.length ? otherBits[i] : 0;
            if (((a & b) >>> 0) !== 0) return false;
        }
        return true;
    }

    orInto(other: Mask): this {
        // 确保当前数组长度至少能容纳 other 的位
        if (this._bits.length < other._bits.length) {
            const newBits = new Uint32Array(other._bits.length);
            newBits.set(this._bits);
            this._bits = newBits;
        }
        for (let i = 0; i < other._bits.length; i++) {
            this._bits[i] |= other._bits[i];
        }
        if (other._length > this._length) {
            this._length = other._length;
        }
        return this;
    }

    /**
     * 将当前掩码与另一个掩码按位与，结果存储在当前掩码中（可变，不产生新对象）。
     * 注意：这会收缩当前掩码的有效长度。
     */
    andInto(other: Mask): this {
        const minLen = Math.min(this._bits.length, other._bits.length);
        // 对重叠部分进行按位与
        for (let i = 0; i < minLen; i++) {
            this._bits[i] &= other._bits[i];
        }
        // 如果当前掩码比 other 长，则超出部分全部置零（因为 other 没有这些高位）
        for (let i = minLen; i < this._bits.length; i++) {
            this._bits[i] = 0;
        }
        // 重新计算有效长度
        this._length = 0;
        for (let i = 0; i < this._bits.length; i++) {
            if (this._bits[i] !== 0) {
                this._length = Math.max(this._length, (i << 5) + (31 - Math.clz32(this._bits[i])) + 1);
            }
        }
        return this;
    }

    xorInto(other: Mask): this {
        const maxLen = Math.max(this._bits.length, other._bits.length);
        if (this._bits.length < maxLen) {
            const newBits = new Uint32Array(maxLen);
            newBits.set(this._bits);
            this._bits = newBits;
        }
        for (let i = 0; i < other._bits.length; i++) {
            this._bits[i] ^= other._bits[i];
        }
        return this;
    }
    andNotInto(other: Mask): this {
        const maxLen = Math.max(this._bits.length, other._bits.length);
        if (this._bits.length < maxLen) {
            const newBits = new Uint32Array(maxLen);
            newBits.set(this._bits);
            this._bits = newBits;
        }
        for (let i = 0; i < other._bits.length; i++) {
            this._bits[i] &= ~other._bits[i];
        }
        return this;
    }
    /** 判断相等 */
    equals(other: Mask): boolean {
        const maxLen = Math.max(this._bits.length, other._bits.length);
        for (let i = 0; i < maxLen; i++) {
            const a = i < this._bits.length ? this._bits[i] : 0;
            const b = i < other._bits.length ? other._bits[i] : 0;
            if (a !== b) return false;
        }
        return true;
    }

    compare(other: Mask): number {
        const aBits = this._bits;
        const bBits = other._bits;
        let len = Math.max(aBits.length, bBits.length);
        while (len > 0) {
            const i = len - 1;
            const a = i < aBits.length ? aBits[i] : 0;
            const b = i < bBits.length ? bBits[i] : 0;
            if (a !== b) return (a >>> 0) < (b >>> 0) ? -1 : 1;
            len--;
        }
        return 0;
    }

    /** 获取有效位数（最高位+1） */
    get length(): number {
        return this._length;
    }

    /** 调试用：返回位数组的副本 */
    get words(): Uint32Array {
        return this._bits.slice();
    }

    static readonly EMPTY = Mask.empty();
}
