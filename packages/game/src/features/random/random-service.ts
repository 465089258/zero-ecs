import { Inject } from "../../context/injection/injection";
import { Service } from "../../context/service";
import { State } from "../../context/state";
import type { Mut } from "../../runtime/system";

/** 确定性随机数生成器的 World-local 状态。 */
export class RandomState extends State {
    readonly a: number = 0;
    readonly b: number = 0;
    readonly c: number = 0;
    readonly d: number = 0;
}

/** 基于 sfc32、可通过种子复现结果的伪随机服务。 */
export class RandomService extends Service {
    @Inject.state(RandomState) private readonly _state!: Mut<RandomState>;

    init(): void { this.seed(0); }

    /** 使用数字种子重置随机序列。 */
    seed(seed: number): void {
        if (!Number.isFinite(seed)) throw new RangeError(`Random seed must be finite, received ${seed}`);
        let s = seed | 0;
        s = (s + 0x9e3779b9) | 0; this._state.a = splitmix32(s);
        s = (s + 0x9e3779b9) | 0; this._state.b = splitmix32(s);
        s = (s + 0x9e3779b9) | 0; this._state.c = splitmix32(s);
        s = (s + 0x9e3779b9) | 0; this._state.d = splitmix32(s);
    }

    /**
     * 核心确定性随机数生成器 (sfc32)
     * 返回 [0, 1) 的浮点数
     */
    private next(): number {
        const state = this._state;
        let t = (state.a + state.b | 0) + state.d | 0;
        state.d = state.d + 1 | 0;
        state.a = state.b ^ (state.b >>> 9);
        state.b = state.c + (state.c << 3) | 0;
        state.c = (state.c << 21) | (state.c >>> 11);
        state.c = state.c + t | 0;
        // 乘法代替除法，返回 32 位精度的 [0,1) 浮点数
        return (t >>> 0) * 2.3283064365386963e-10;
    }

    /** 返回 `[0, 1)` 范围的浮点数。 */
    float(): number;
    /** 返回 `[0, max)` 范围的浮点数。 */
    float(max: number): number;
    /** 返回 `[min, max)` 范围的浮点数。 */
    float(min: number, max: number): number;
    float(min?: number, max?: number): number {
        if (min !== undefined && max !== undefined) {
            requireFiniteRange("RandomService.float", min, max);
            return this.next() * (max - min) + min;
        } else if (min !== undefined) {
            if (!Number.isFinite(min) || min <= 0) {
                throw new RangeError(`RandomService.float max must be finite and > 0, received ${min}`);
            }
            return this.next() * min;
        } else {
            return this.next();
        }
    }

    /** 返回 `[0, 2^32 - 1]` 范围的无符号整数。 */
    int(): number;
    /** 返回 `[0, max)` 范围的整数。 */
    int(max: number): number;
    /** 返回 `[min, max)` 范围的整数。 */
    int(min: number, max: number): number;
    int(min?: number, max?: number): number {
        if (min !== undefined && max !== undefined) {
            requireIntegerRange("RandomService.int", min, max);
            return Math.floor(this.next() * (max - min) + min);
        } else if (min !== undefined) {
            if (!Number.isSafeInteger(min) || min <= 0) {
                throw new RangeError(`RandomService.int max must be a safe integer > 0, received ${min}`);
            }
            return Math.floor(this.next() * min);
        } else {
            // 直接输出 32 位无符号整数，快且完全符合生成器精度
            return (this.next() * 0x100000000) >>> 0;
        }
    }

    /** 从非空数组中等概率返回一个元素。 */
    elem<T>(array: readonly T[]): T {
        if (array.length === 0) throw new RangeError("RandomService.elem requires a non-empty array");
        const idx = this.int(array.length);
        return array[idx];
    }

    /** 按正权重随机返回一个元素；可传入已知总权重进行一致性校验。 */
    weight<T>(array: ReadonlyArray<readonly [number, T]>, totalWeight?: number): T {
        if (array.length === 0) throw new RangeError("RandomService.weight requires a non-empty array");
        let calculatedWeight = 0;
        for (let i = 0; i < array.length; i++) {
            const weight = array[i][0];
            if (!Number.isFinite(weight) || weight <= 0) {
                throw new RangeError(`RandomService.weight requires finite positive weights, received ${weight}`);
            }
            calculatedWeight += weight;
        }
        if (totalWeight !== undefined && totalWeight !== calculatedWeight) {
            throw new RangeError(
                `RandomService.weight total ${totalWeight} does not match calculated total ${calculatedWeight}`,
            );
        }
        let randomWeight = this.next() * calculatedWeight;
        for (let i = 0; i < array.length; i++) {
            const [weight, value] = array[i];
            if (randomWeight < weight) return value;
            randomWeight -= weight;
        }
        return array[array.length - 1][1];
    }
}

function requireFiniteRange(name: string, min: number, max: number): void {
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
        throw new RangeError(`${name} requires finite min < max, received ${min}, ${max}`);
    }
}

function requireIntegerRange(name: string, min: number, max: number): void {
    if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || max <= min) {
        throw new RangeError(`${name} requires safe integer min < max, received ${min}, ${max}`);
    }
}

function splitmix32(value: number): number {
    value = Math.imul(value ^ (value >>> 16), 0x85ebca6b);
    value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35);
    return value ^ (value >>> 16);
}
