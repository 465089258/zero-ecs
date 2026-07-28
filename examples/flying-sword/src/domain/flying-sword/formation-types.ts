/** 飞剑示例本地领域实现。 */
/** 内置阵图计划的稳定数字标识。 */
export const FlyingSwordFormationPlanId = Object.freeze({
    EightGates: 1,
    Lotus: 2,
} as const);

export type FlyingSwordFormationPlanId =
    (typeof FlyingSwordFormationPlanId)[
        keyof typeof FlyingSwordFormationPlanId
    ];

/** 阵图路径原语；稳定帧按数字值直接分派求值。 */
export const FlyingSwordFormationPrimitive = Object.freeze({
    RegularPolygon: 0,
    StarPolygon: 1,
    Lemniscate: 2,
    Rose: 3,
} as const);

export type FlyingSwordFormationPrimitive =
    (typeof FlyingSwordFormationPrimitive)[
        keyof typeof FlyingSwordFormationPrimitive
    ];

/** 作者态阵图路径。目录构造时会把它编译为连续数字表。 */
export interface FlyingSwordFormationRouteDefinition {
    readonly primitive: FlyingSwordFormationPrimitive;
    /** 相对控制组 OrbitRadius 的水平半径。 */
    readonly radius: number;
    readonly rotation?: number;
    /** 只允许 1 或 -1。 */
    readonly direction?: number;
    readonly speed?: number;
    readonly phaseOffset?: number;
    /** 相对控制组基础编队高度的局部 Y 偏移。 */
    readonly height?: number;
    readonly verticalAmplitude?: number;
    readonly verticalFrequency?: number;
    /** 正多边形边数或星形顶点数。 */
    readonly vertices?: number;
    /** 星形路径的内外半径比。 */
    readonly innerRadius?: number;
    /** 玫瑰线花瓣参数。 */
    readonly petals?: number;
    /** 双纽线纵深缩放。 */
    readonly depthScale?: number;
    /** Slot Schedule 中的整数权重。 */
    readonly weight?: number;
}

/** 作者态阵图计划。 */
export interface FlyingSwordFormationPlanDefinition {
    readonly id: number;
    readonly name: string;
    readonly routes: readonly FlyingSwordFormationRouteDefinition[];
}

/** 编译后可公开观察的阵图元数据。 */
export interface CompiledFlyingSwordFormationPlan {
    readonly id: number;
    readonly name: string;
    readonly routeCount: number;
    readonly scheduleLength: number;
}

/** 调用方复用的局部 3D 路径采样输出。 */
export interface FlyingSwordFormationRouteSample {
    x: number;
    y: number;
    z: number;
    tangentX: number;
    tangentY: number;
    tangentZ: number;
}

/** 调用方复用的稳定 Slot 解析输出。 */
export interface FlyingSwordFormationSlotSample {
    route: number;
    routeSlot: number;
    routeSwordCount: number;
    phaseOffset: number;
}
