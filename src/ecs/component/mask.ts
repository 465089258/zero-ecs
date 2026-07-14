/** 支持任意组件数量的动态位掩码。 */
export class Mask {
    private _bits: Uint32Array;
    private _length: number; // 有效位数

    private constructor(bits: Uint32Array, length: number) {
        this._bits = bits;
        this._length = length;
    }
    /** 原地清空全部位，并保留已分配容量供后续复用。 */
    toZero(): void {
        this._length = 0;
        this._bits.fill(0);
    }
    /** 创建仅指定位置为 `1` 的掩码。 */
    static fromBit(bit: number): Mask {
        Mask.assertBit(bit);
        const wordIndex = bit >>> 5;           // 除以 32
        const bitInWord = bit & 31;            // 取余
        const length = bit + 1;
        const bits = new Uint32Array(wordIndex + 1);
        bits[wordIndex] = 1 << bitInWord;
        return new Mask(bits, length);
    }

    /** 创建空掩码。 */
    static empty(): Mask {
        return new Mask(new Uint32Array(0), 0);
    }

    /** 创建从第 `0` 位到指定位置均为 `1` 的掩码。 */
    static fill(bit: number): Mask {
        Mask.assertBit(bit);
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
    /** 返回低 32 位，不产生数组副本。 */
    v0() {
        return this._bits[0] ?? 0;
    }
    /** 返回第 32 至 63 位，不产生数组副本。 */
    v1() {
        return this._bits[1] ?? 0;
    }
    /** 返回第 64 至 95 位，不产生数组副本。 */
    v2() {
        return this._bits[2] ?? 0;
    }
    /** 返回第 96 至 127 位，不产生数组副本。 */
    v3() {
        return this._bits[3] ?? 0;
    }

    /** 创建当前掩码的独立副本。 */
    clone(): Mask {
        return new Mask(new Uint32Array(this._bits), this._length);
    }
    /** 将当前内容复制到目标掩码，并复用目标已有容量。 */
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
        target._length = this._length;
    }
    /** 返回与 `other` 的并集，不修改当前对象。 */
    or(other: Mask): Mask {
        return this.clone().orInto(other);
    }

    /** 返回与 `other` 的交集，不修改当前对象。 */
    and(other: Mask): Mask {
        return this.clone().andInto(other);
    }

    /** 判断当前掩码是否包含 `other` 的全部有效位。 */
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

    /** 判断当前掩码是否与 `other` 完全无交集。 */
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

    /** 原地合并 `other` 的全部有效位。 */
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

    /** 原地计算与 `other` 的交集，并收缩有效长度。 */
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
        this.recomputeLength();
        return this;
    }

    /** 原地计算与 `other` 的异或结果。 */
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
        this.recomputeLength();
        return this;
    }
    /** 原地清除 `other` 包含的全部位。 */
    andNotInto(other: Mask): this {
        const minLen = Math.min(this._bits.length, other._bits.length);
        for (let i = 0; i < minLen; i++) {
            this._bits[i] &= ~other._bits[i];
        }
        this.recomputeLength();
        return this;
    }
    /** 判断两个掩码的有效位是否相同。 */
    equals(other: Mask): boolean {
        const maxLen = Math.max(this._bits.length, other._bits.length);
        for (let i = 0; i < maxLen; i++) {
            const a = i < this._bits.length ? this._bits[i] : 0;
            const b = i < other._bits.length ? other._bits[i] : 0;
            if (a !== b) return false;
        }
        return true;
    }

    /** 按高位优先比较两个掩码，用于建立稳定排序。 */
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

    /** 有效位数，即最高有效位索引加一。 */
    get length(): number {
        return this._length;
    }

    /** 返回内部字数组的副本，主要用于诊断。 */
    get words(): Uint32Array {
        return this._bits.slice();
    }

    private recomputeLength(): void {
        for (let i = this._bits.length - 1; i >= 0; i--) {
            const word = this._bits[i];
            if (word !== 0) {
                this._length = (i << 5) + (32 - Math.clz32(word));
                return;
            }
        }
        this._length = 0;
    }

    private static assertBit(bit: number): void {
        if (!Number.isSafeInteger(bit) || bit < 0 || bit > 0xFFFFFFFF) {
            throw new RangeError(`Mask bit must be an integer between 0 and 4294967295: ${bit}`);
        }
    }

    /** 共享空掩码；需要修改时应先克隆，避免污染全局值。 */
    static readonly EMPTY = Mask.empty();
}
