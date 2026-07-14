import { Service } from "../../context/types";

export class RandomService extends Service {
    // sfc32 所需的四个 32 位状态
    private _a!: number;
    private _b!: number;
    private _c!: number;
    private _d!: number;

    seed(seed: number) {
        let s = seed | 0;
        s = splitmix32(s); this._a = s;
        s = splitmix32(s); this._b = s;
        s = splitmix32(s); this._c = s;
        s = splitmix32(s); this._d = s;
    }

    /**
     * 核心确定性随机数生成器 (sfc32)
     * 返回 [0, 1) 的浮点数
     */
    private next(): number {
        let t = (this._a + this._b | 0) + this._d | 0;
        this._d = this._d + 1 | 0;
        this._a = this._b ^ (this._b >>> 9);
        this._b = this._c + (this._c << 3) | 0;
        this._c = (this._c << 21) | (this._c >>> 11);
        this._c = this._c + t | 0;
        // 乘法代替除法，返回 32 位精度的 [0,1) 浮点数
        return (t >>> 0) * 2.3283064365386963e-10;
    }

    /** 随机0.0 - 1.0 浮点数 */
    float(): number;
    /** 随机 0.0 - max 浮点数 */
    float(max: number): number;
    /** 随机 min - max 浮点数 */
    float(min: number, max: number): number;
    float(min?: number, max?: number): number {
        const v = this.next();
        if (min !== undefined && max !== undefined) {
            return v * (max - min) + min;
        } else if (min !== undefined) {
            return v * min;
        } else {
            return v;
        }
    }

    /** 随机整数 (0 ~ 2^32-1) */
    int(): number;
    /** 随机 0 - max 整数 */
    int(max: number): number;
    /** 随机 min - max 整数 */
    int(min: number, max: number): number;
    int(min?: number, max?: number): number {
        if (min !== undefined && max !== undefined) {
            // 保持浮点数映射方式，保证区间均匀
            return Math.floor(this.next() * (max - min) + min);
        } else if (min !== undefined) {
            return Math.floor(this.next() * min);
        } else {
            // 直接输出 32 位无符号整数，快且完全符合生成器精度
            return (this.next() * 0x100000000) >>> 0;
        }
    }

    /** 随机数组中一个元素 */
    elem<T>(array: Array<T>): T {
        const idx = this.int(array.length);
        return array[idx];
    }

    /** 权重池随机一个元素 */
    weight<T>(array: Array<[number, T]>, totalWeight?: number): T {
        if (totalWeight === undefined) {
            totalWeight = 0;
            for (let i = 0; i < array.length; i++) totalWeight += array[i][0];
        }
        let randomWeight = this.int(totalWeight);
        for (let i = 0; i < array.length; i++) {
            const [weight, value] = array[i];
            randomWeight -= weight;
            if (randomWeight <= 0) {
                return value;
            }
        }
        return array[array.length - 1][1];
    }
}

function splitmix32(value: number): number {
    value = Math.imul(value ^ (value >>> 16), 0x85ebca6b);
    value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35);
    return value ^ (value >>> 16);
}
