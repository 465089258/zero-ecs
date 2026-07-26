import { Resource } from "@zero-ecs/game";
import {
    FlyingSwordFormationPlanId,
    FlyingSwordFormationPrimitive,
    type CompiledFlyingSwordFormationPlan,
    type FlyingSwordFormationPlanDefinition,
    type FlyingSwordFormationRouteDefinition,
    type FlyingSwordFormationRouteSample,
    type FlyingSwordFormationSlotSample,
} from "./formation-types";

/** 当前外八边与两条反向内方形迁移后的默认阵图。 */
export const EightGatesFormationPlan: FlyingSwordFormationPlanDefinition =
    Object.freeze({
        id: FlyingSwordFormationPlanId.EightGates,
        name: "八门周天阵",
        routes: Object.freeze([
            Object.freeze({
                primitive: FlyingSwordFormationPrimitive.RegularPolygon,
                radius: 0.94,
                rotation: Math.PI / 8,
                speed: 0.86,
                height: 0,
                verticalAmplitude: 0.08,
                verticalFrequency: 2,
                vertices: 8,
            }),
            Object.freeze({
                primitive: FlyingSwordFormationPrimitive.RegularPolygon,
                radius: 0.78,
                rotation: Math.PI / 4,
                speed: 1.18,
                height: 0.18,
                verticalAmplitude: 0.08,
                verticalFrequency: 2,
                vertices: 4,
            }),
            Object.freeze({
                primitive: FlyingSwordFormationPrimitive.RegularPolygon,
                radius: 0.78,
                direction: -1,
                speed: 1.03,
                height: -0.12,
                verticalAmplitude: 0.08,
                verticalFrequency: 2,
                vertices: 4,
            }),
        ]),
    });

/** 使用玫瑰、双纽线和星形路径组合出的第二套内置阵图。 */
export const LotusFormationPlan: FlyingSwordFormationPlanDefinition =
    Object.freeze({
        id: FlyingSwordFormationPlanId.Lotus,
        name: "莲华剑阵",
        routes: Object.freeze([
            Object.freeze({
                primitive: FlyingSwordFormationPrimitive.Rose,
                radius: 0.92,
                speed: 0.82,
                verticalAmplitude: 0.1,
                verticalFrequency: 4,
                petals: 4,
                weight: 2,
            }),
            Object.freeze({
                primitive: FlyingSwordFormationPrimitive.Lemniscate,
                radius: 0.82,
                direction: -1,
                speed: 1.08,
                height: 0.16,
                verticalAmplitude: 0.06,
                verticalFrequency: 2,
                depthScale: 1.72,
            }),
            Object.freeze({
                primitive: FlyingSwordFormationPrimitive.StarPolygon,
                radius: 0.68,
                rotation: -Math.PI / 2,
                speed: 1.32,
                height: -0.1,
                verticalAmplitude: 0.05,
                verticalFrequency: 5,
                vertices: 5,
                innerRadius: 0.42,
            }),
        ]),
    });

/**
 * 编译阵图的只读目录。
 *
 * 作者对象只在构造冷路径出现。稳定帧直接访问连续数字表，采样写入调用方
 * 提供的输出对象，不返回临时向量或路径对象。
 */
export class FlyingSwordFormationCatalog extends Resource {
    private readonly plans:
        Array<CompiledFlyingSwordFormationPlan | undefined>;
    private readonly planRouteStarts: Uint16Array;
    private readonly planRouteCounts: Uint16Array;
    private readonly planScheduleStarts: Uint16Array;
    private readonly planScheduleCounts: Uint16Array;
    private readonly routePrimitives: Uint8Array;
    private readonly routeRadii: Float32Array;
    private readonly routeRotations: Float32Array;
    private readonly routeSignedSpeeds: Float32Array;
    private readonly routePhaseOffsets: Float32Array;
    private readonly routeHeights: Float32Array;
    private readonly routeVerticalAmplitudes: Float32Array;
    private readonly routeVerticalFrequencies: Float32Array;
    private readonly routeShapeAs: Float32Array;
    private readonly routeShapeBs: Float32Array;
    private readonly scheduleRoutes: Uint16Array;

    constructor(
        definitions: readonly FlyingSwordFormationPlanDefinition[] = [],
    ) {
        super();
        const sources = [
            EightGatesFormationPlan,
            LotusFormationPlan,
            ...definitions,
        ];
        let maximumPlanId = 0;
        let routeTotal = 0;
        let scheduleTotal = 0;
        const seen = new Set<number>();
        for (let index = 0; index < sources.length; index++) {
            const plan = sources[index];
            validatePlan(plan);
            if (seen.has(plan.id)) {
                throw new Error(
                    `Duplicate flying sword formation plan: ${plan.id}`,
                );
            }
            seen.add(plan.id);
            maximumPlanId = Math.max(maximumPlanId, plan.id);
            routeTotal += plan.routes.length;
            for (let route = 0; route < plan.routes.length; route++) {
                scheduleTotal += plan.routes[route].weight ?? 1;
            }
        }
        if (routeTotal > 0xffff || scheduleTotal > 0xffff) {
            throw new RangeError(
                "Flying sword formation catalog exceeds U16 table capacity",
            );
        }

        this.plans = new Array(maximumPlanId + 1);
        this.planRouteStarts = new Uint16Array(maximumPlanId + 1);
        this.planRouteCounts = new Uint16Array(maximumPlanId + 1);
        this.planScheduleStarts = new Uint16Array(maximumPlanId + 1);
        this.planScheduleCounts = new Uint16Array(maximumPlanId + 1);
        this.routePrimitives = new Uint8Array(routeTotal);
        this.routeRadii = new Float32Array(routeTotal);
        this.routeRotations = new Float32Array(routeTotal);
        this.routeSignedSpeeds = new Float32Array(routeTotal);
        this.routePhaseOffsets = new Float32Array(routeTotal);
        this.routeHeights = new Float32Array(routeTotal);
        this.routeVerticalAmplitudes = new Float32Array(routeTotal);
        this.routeVerticalFrequencies = new Float32Array(routeTotal);
        this.routeShapeAs = new Float32Array(routeTotal);
        this.routeShapeBs = new Float32Array(routeTotal);
        this.scheduleRoutes = new Uint16Array(scheduleTotal);

        let routeCursor = 0;
        let scheduleCursor = 0;
        for (let index = 0; index < sources.length; index++) {
            const plan = sources[index];
            const routeCount = plan.routes.length;
            const scheduleStart = scheduleCursor;
            let maximumWeight = 1;
            for (let route = 0; route < routeCount; route++) {
                maximumWeight = Math.max(
                    maximumWeight,
                    plan.routes[route].weight ?? 1,
                );
                this.writeRoute(routeCursor + route, plan.routes[route]);
            }
            for (let round = 0; round < maximumWeight; round++) {
                for (let route = 0; route < routeCount; route++) {
                    if ((plan.routes[route].weight ?? 1) > round) {
                        this.scheduleRoutes[scheduleCursor++] = route;
                    }
                }
            }
            const metadata = Object.freeze({
                id: plan.id,
                name: plan.name,
                routeCount,
                scheduleLength: scheduleCursor - scheduleStart,
            });
            this.plans[plan.id] = metadata;
            this.planRouteStarts[plan.id] = routeCursor;
            this.planRouteCounts[plan.id] = routeCount;
            this.planScheduleStarts[plan.id] = scheduleStart;
            this.planScheduleCounts[plan.id] =
                scheduleCursor - scheduleStart;
            routeCursor += routeCount;
        }
    }

    get(id: number): CompiledFlyingSwordFormationPlan | undefined {
        return this.plans[id];
    }

    require(id: number): CompiledFlyingSwordFormationPlan {
        const plan = this.get(id);
        if (!plan) {
            throw new RangeError(
                `Unknown flying sword formation plan: ${id}`,
            );
        }
        return plan;
    }

    /**
     * 把稳定 Slot 映射到路径及路径内相位。
     *
     * 计算只扫描较短的编译 Schedule，不创建逐剑数组。
     */
    resolveSlot(
        planId: number,
        slot: number,
        formationSize: number,
        out: FlyingSwordFormationSlotSample,
    ): void {
        this.require(planId);
        integer("slot", slot, 0, 0xffff);
        integer("formationSize", formationSize, 1, 0xffff);
        const scheduleStart = this.planScheduleStarts[planId];
        const scheduleCount = this.planScheduleCounts[planId];
        const logicalSlot = slot % formationSize;
        const scheduleIndex = logicalSlot % scheduleCount;
        const route =
            this.scheduleRoutes[scheduleStart + scheduleIndex];
        let routeOccurrences = 0;
        let beforeOccurrences = 0;
        for (let index = 0; index < scheduleCount; index++) {
            if (
                this.scheduleRoutes[scheduleStart + index] !== route
            ) {
                continue;
            }
            routeOccurrences++;
            if (index < scheduleIndex) beforeOccurrences++;
        }
        const fullSlotCycles = Math.floor(
            logicalSlot / scheduleCount,
        );
        const routeSlot =
            fullSlotCycles * routeOccurrences + beforeOccurrences;
        const fullSizeCycles = Math.floor(
            formationSize / scheduleCount,
        );
        const sizeRemainder = formationSize % scheduleCount;
        let remainderOccurrences = 0;
        for (let index = 0; index < sizeRemainder; index++) {
            if (
                this.scheduleRoutes[scheduleStart + index] === route
            ) {
                remainderOccurrences++;
            }
        }
        const routeSwordCount = Math.max(
            1,
            fullSizeCycles * routeOccurrences + remainderOccurrences,
        );
        out.route = route;
        out.routeSlot = routeSlot;
        out.routeSwordCount = routeSwordCount;
        out.phaseOffset =
            routeSlot * Math.PI * 2 / routeSwordCount;
    }

    /** 将指定路径的局部 3D 位置与切线写入复用输出。 */
    sampleRoute(
        planId: number,
        route: number,
        phase: number,
        out: FlyingSwordFormationRouteSample,
    ): void {
        this.require(planId);
        integer(
            "route",
            route,
            0,
            this.planRouteCounts[planId] - 1,
        );
        finite("phase", phase);
        const index = this.planRouteStarts[planId] + route;
        const signedSpeed = this.routeSignedSpeeds[index];
        const localPhase =
            phase * signedSpeed + this.routePhaseOffsets[index];
        const radius = this.routeRadii[index];
        const rotation = this.routeRotations[index];
        const shapeA = this.routeShapeAs[index];
        const shapeB = this.routeShapeBs[index];
        let x = 0;
        let z = 0;
        let tangentX = 0;
        let tangentZ = 0;

        const primitive = this.routePrimitives[index];
        if (
            primitive ===
            FlyingSwordFormationPrimitive.RegularPolygon
        ) {
            const sides = shapeA;
            const turns = localPhase / TWO_PI;
            const wrapped = turns - Math.floor(turns);
            const edgePosition = wrapped * sides;
            const edge = Math.floor(edgePosition);
            const progress = edgePosition - edge;
            const startAngle = rotation + edge * TWO_PI / sides;
            const endAngle = rotation + (edge + 1) * TWO_PI / sides;
            const startX = Math.cos(startAngle);
            const startZ = Math.sin(startAngle);
            const deltaX = Math.cos(endAngle) - startX;
            const deltaZ = Math.sin(endAngle) - startZ;
            x = (startX + deltaX * progress) * radius;
            z = (startZ + deltaZ * progress) * radius;
            const edgeRate = sides / TWO_PI;
            tangentX = deltaX * radius * edgeRate;
            tangentZ = deltaZ * radius * edgeRate;
        } else if (
            primitive === FlyingSwordFormationPrimitive.StarPolygon
        ) {
            const vertices = shapeA * 2;
            const turns = localPhase / TWO_PI;
            const wrapped = turns - Math.floor(turns);
            const edgePosition = wrapped * vertices;
            const edge = Math.floor(edgePosition);
            const progress = edgePosition - edge;
            const startAngle =
                rotation + edge * TWO_PI / vertices;
            const endAngle =
                rotation + (edge + 1) * TWO_PI / vertices;
            const startRadius = (edge & 1) === 0 ? radius : radius * shapeB;
            const endRadius =
                ((edge + 1) & 1) === 0 ? radius : radius * shapeB;
            const startX = Math.cos(startAngle) * startRadius;
            const startZ = Math.sin(startAngle) * startRadius;
            const deltaX =
                Math.cos(endAngle) * endRadius - startX;
            const deltaZ =
                Math.sin(endAngle) * endRadius - startZ;
            x = startX + deltaX * progress;
            z = startZ + deltaZ * progress;
            const edgeRate = vertices / TWO_PI;
            tangentX = deltaX * edgeRate;
            tangentZ = deltaZ * edgeRate;
        } else if (
            primitive === FlyingSwordFormationPrimitive.Lemniscate
        ) {
            const sine = Math.sin(localPhase);
            const cosine = Math.cos(localPhase);
            const denominator = 1 + sine * sine;
            const denominatorDerivative = 2 * sine * cosine;
            const inverseSquared = 1 /
                (denominator * denominator);
            const numerator = sine * cosine;
            const numeratorDerivative =
                cosine * cosine - sine * sine;
            x = cosine / denominator * radius;
            z = numerator / denominator * radius * shapeA;
            tangentX =
                (
                    -sine * denominator -
                    cosine * denominatorDerivative
                ) * inverseSquared * radius;
            tangentZ =
                (
                    numeratorDerivative * denominator -
                    numerator * denominatorDerivative
                ) * inverseSquared * radius * shapeA;
        } else {
            const petals = shapeA;
            const cosine = Math.cos(localPhase);
            const sine = Math.sin(localPhase);
            const roseRadius = Math.cos(petals * localPhase);
            const radiusDerivative =
                -petals * Math.sin(petals * localPhase);
            x = roseRadius * cosine * radius;
            z = roseRadius * sine * radius;
            tangentX =
                (radiusDerivative * cosine - roseRadius * sine) *
                radius;
            tangentZ =
                (radiusDerivative * sine + roseRadius * cosine) *
                radius;
        }

        const verticalAmplitude =
            this.routeVerticalAmplitudes[index];
        const verticalFrequency =
            this.routeVerticalFrequencies[index];
        const verticalPhase = localPhase * verticalFrequency;
        const y =
            this.routeHeights[index] +
            Math.sin(verticalPhase) * verticalAmplitude;
        let tangentY =
            Math.cos(verticalPhase) *
            verticalFrequency *
            verticalAmplitude;
        tangentX *= signedSpeed;
        tangentY *= signedSpeed;
        tangentZ *= signedSpeed;
        const tangentLength = Math.sqrt(
            tangentX * tangentX +
            tangentY * tangentY +
            tangentZ * tangentZ,
        );
        const inverseTangent = tangentLength > TANGENT_EPSILON
            ? 1 / tangentLength
            : 0;
        out.x = x;
        out.y = y;
        out.z = z;
        out.tangentX = tangentX * inverseTangent;
        out.tangentY = tangentY * inverseTangent;
        out.tangentZ = tangentZ * inverseTangent;
    }

    private writeRoute(
        index: number,
        route: FlyingSwordFormationRouteDefinition,
    ): void {
        const primitive = route.primitive;
        this.routePrimitives[index] = primitive;
        this.routeRadii[index] = route.radius;
        this.routeRotations[index] = route.rotation ?? 0;
        this.routeSignedSpeeds[index] =
            (route.direction ?? 1) * (route.speed ?? 1);
        this.routePhaseOffsets[index] = route.phaseOffset ?? 0;
        this.routeHeights[index] = route.height ?? 0;
        this.routeVerticalAmplitudes[index] =
            route.verticalAmplitude ?? 0;
        this.routeVerticalFrequencies[index] =
            route.verticalFrequency ?? 1;
        if (
            primitive ===
            FlyingSwordFormationPrimitive.RegularPolygon
        ) {
            this.routeShapeAs[index] = route.vertices ?? 3;
            this.routeShapeBs[index] = 1;
        } else if (
            primitive === FlyingSwordFormationPrimitive.StarPolygon
        ) {
            this.routeShapeAs[index] = route.vertices ?? 5;
            this.routeShapeBs[index] = route.innerRadius ?? 0.5;
        } else if (
            primitive === FlyingSwordFormationPrimitive.Lemniscate
        ) {
            this.routeShapeAs[index] = route.depthScale ?? 1.7;
            this.routeShapeBs[index] = 0;
        } else {
            this.routeShapeAs[index] = route.petals ?? 4;
            this.routeShapeBs[index] = 0;
        }
    }
}

function validatePlan(plan: FlyingSwordFormationPlanDefinition): void {
    integer("id", plan.id, 1, 0xffff);
    if (plan.name.trim().length === 0) {
        throw new RangeError("formation plan name must not be empty");
    }
    integer("route count", plan.routes.length, 1, 0xffff);
    for (let index = 0; index < plan.routes.length; index++) {
        validateRoute(plan.routes[index]);
    }
}

function validateRoute(route: FlyingSwordFormationRouteDefinition): void {
    integer(
        "primitive",
        route.primitive,
        FlyingSwordFormationPrimitive.RegularPolygon,
        FlyingSwordFormationPrimitive.Rose,
    );
    positive("radius", route.radius);
    finite("rotation", route.rotation ?? 0);
    const direction = route.direction ?? 1;
    if (direction !== 1 && direction !== -1) {
        throw new RangeError("direction must be 1 or -1");
    }
    positive("speed", route.speed ?? 1);
    finite("phaseOffset", route.phaseOffset ?? 0);
    finite("height", route.height ?? 0);
    nonNegative(
        "verticalAmplitude",
        route.verticalAmplitude ?? 0,
    );
    positive("verticalFrequency", route.verticalFrequency ?? 1);
    integer("weight", route.weight ?? 1, 1, 0xffff);
    if (
        route.primitive ===
        FlyingSwordFormationPrimitive.RegularPolygon
    ) {
        integer("vertices", route.vertices ?? 3, 3, 0xffff);
    } else if (
        route.primitive === FlyingSwordFormationPrimitive.StarPolygon
    ) {
        integer("vertices", route.vertices ?? 5, 3, 0x7fff);
        ratio("innerRadius", route.innerRadius ?? 0.5);
    } else if (
        route.primitive === FlyingSwordFormationPrimitive.Lemniscate
    ) {
        positive("depthScale", route.depthScale ?? 1.7);
    } else {
        integer("petals", route.petals ?? 4, 1, 0xffff);
    }
}

function finite(name: string, value: number): void {
    if (!Number.isFinite(value)) {
        throw new RangeError(`${name} must be finite`);
    }
}

function positive(name: string, value: number): void {
    if (!Number.isFinite(value) || value <= 0) {
        throw new RangeError(
            `${name} must be a finite positive number`,
        );
    }
}

function nonNegative(name: string, value: number): void {
    if (!Number.isFinite(value) || value < 0) {
        throw new RangeError(
            `${name} must be finite and non-negative`,
        );
    }
}

function ratio(name: string, value: number): void {
    if (!Number.isFinite(value) || value <= 0 || value >= 1) {
        throw new RangeError(`${name} must be in (0, 1)`);
    }
}

function integer(
    name: string,
    value: number,
    minimum: number,
    maximum: number,
): void {
    if (
        !Number.isSafeInteger(value) ||
        value < minimum ||
        value > maximum
    ) {
        throw new RangeError(
            `${name} must be an integer in [${minimum}, ${maximum}]`,
        );
    }
}

const TWO_PI = Math.PI * 2;
const TANGENT_EPSILON = 1e-8;
