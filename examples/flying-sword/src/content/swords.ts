import { Resource } from "@zero-ecs/game";

export enum SwordBlueprint {
    Light,
    Heavy,
    Spirit,
    Burst,
}

export enum SwordRecommendation {
    Scatter,
    Focus,
    Formation,
    Burst,
}

/**
 * 剑器模板目录。运行时按 Blueprint 直接读取 SoA 列，Offer 随机只在模板区间内波动。
 */
export class SwordBlueprintCatalog extends Resource {
    readonly names = Object.freeze([
        "轻灵剑",
        "重锋剑",
        "灵枢剑",
        "爆发剑",
    ]);
    readonly recommendationNames = Object.freeze([
        "分散御剑",
        "集火贯穿",
        "剑阵持久",
        "高法爆发",
    ]);
    readonly recommendations = new Uint8Array([
        SwordRecommendation.Scatter,
        SwordRecommendation.Focus,
        SwordRecommendation.Formation,
        SwordRecommendation.Burst,
    ]);
    readonly minimumDamage = new Float32Array([10, 21, 14, 12]);
    readonly minimumDamageVariance = new Uint8Array([4, 5, 4, 7]);
    readonly damageSpread = new Float32Array([7, 10, 8, 20]);
    readonly damageSpreadVariance = new Uint8Array([4, 5, 4, 9]);
    readonly attackIntervalTicks = new Uint16Array([18, 34, 26, 31]);
    readonly attackIntervalVariance = new Uint8Array([3, 4, 3, 5]);
    readonly maximumSpeed = new Float32Array([15, 11.5, 13, 15]);
    readonly maximumSpeedVariance = new Float32Array([1, 0.8, 0.8, 1.2]);
    readonly acceleration = new Float32Array([52, 34, 42, 50]);
    readonly accelerationVariance = new Uint8Array([6, 5, 5, 7]);
    readonly maximumSpiritPower = new Float32Array([82, 105, 138, 76]);
    readonly maximumSpiritVariance = new Uint8Array([12, 15, 18, 12]);
    readonly spiritRecoveryPerSecond =
        new Float32Array([17, 12, 23, 10]);
    readonly spiritRecoveryVariance = new Uint8Array([4, 3, 5, 3]);
    readonly scatterSpiritCost = new Float32Array([12, 22, 14, 20]);
    readonly focusSpiritCost = new Float32Array([18, 30, 20, 32]);
    readonly formationSpiritDrainPerSecond =
        new Float32Array([5, 7, 3.5, 8]);
    readonly count = this.names.length;

    isValid(blueprint: number): boolean {
        return Number.isInteger(blueprint) &&
            blueprint >= 0 &&
            blueprint < this.count;
    }
}
