import {
    Types,
    type Component,
    type ComponentTag,
} from "@zero-ecs/game";

export enum DamageDisplayStyle {
    Dealt,
    Taken,
    ScatterSword,
    FocusSword,
    FormationSword,
    SwordBodyUnity,
    LightningChain,
    MetalBreak,
}

export enum DamageDisplay {
    Amount,
    StartTick,
    DurationTicks,
    Style,
    HorizontalOffset,
}

/** 一次短生命周期的世界空间伤害数字。 */
export class DamageDisplayType implements Component<DamageDisplay> {
    readonly [DamageDisplay.Amount] = Types.F32;
    readonly [DamageDisplay.StartTick] = Types.U32;
    readonly [DamageDisplay.DurationTicks] = Types.U16;
    readonly [DamageDisplay.Style] = Types.U8;
    readonly [DamageDisplay.HorizontalOffset] = Types.F32;
}

/** 防止没有安装伤害结算系统时重复捕获同一请求。 */
export class DamageDisplayCapturedTag implements ComponentTag {}
