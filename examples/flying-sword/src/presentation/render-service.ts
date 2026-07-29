import {
    Inject,
    INVALID_ENTITY,
    Service,
    World,
    type Entity,
    type QueryOf,
} from "@zero-ecs/game";
import {
    FlyingSwordFormation,
    FlyingSwordFormationCatalog,
    FlyingSwordFormationPlan,
    FlyingSwordFormationPlanId,
    FlyingSwordGroupQuery,
    FlyingSwordMode,
    ControlledFlyingSwordTag,
    PendingFlyingSwordRetireTag,
    FlyingSwordStance,
    FlyingSwordSkillPhase,
    FlyingSwordSkillService,
    type FlyingSwordFormationRouteSample,
    type FlyingSwordFormationSlotSample,
    type FlyingSwordSkillPhaseValue,
} from "../domain/flying-sword";
import { Float3 } from "../infrastructure/math";
import {
    DepthRenderQueue,
    type DepthRenderItem,
    DemoRenderLayer,
} from "./render-queue";
import {
    TopDownOrthographicCamera,
    degreesToRadians,
    type ProjectedPoint,
} from "./camera";
import { DemoViewResource } from "../app/resources";
import type { Texture } from "pixi.js";
import {
    DemoPixiResource,
    type PixiPainter,
} from "./pixi-renderer";
import {
    FlyingSwordVisual,
} from "../content/components";
import {
    DamageDisplay,
    DamageDisplayStyle,
} from "../damage-display/components";
import { DamageDisplayQuery } from "../damage-display/queries";
import {
    RogueUpgrade,
    RogueUpgradeCatalog,
} from "../content/upgrades";
import { SwordBlueprintCatalog } from "../content/swords";
import { DemoSceneState } from "../simulation/state";
import {
    ColdSwordIntent,
    DamageKind,
    EnemyColdAccumulation,
    EnemyBody,
    EnemyEmpowerment,
    EnemyFeedback,
    EnemyIdentity,
    ExperiencePickup,
    FireBurst,
    FireSwordIntent,
    Health,
    LevelExperience,
    LightningArc,
    LightningSwordIntent,
    MetalSwordIntent,
    PlayerStamina,
    PlayerMana,
    SpiritualSense,
    RogueRunClock,
    RogueRunIdentity,
    RogueRunPhase,
    RogueRunStatistics,
    RogueRunStatus,
    RogueRunTarget,
    StoneGolemCharge,
    StoneGolemChargePhase,
    SwordWraithEmpowerment,
    SwordBodyUnity,
    UpgradeSelection,
    SwordUpgradeOffer,
    SwordUpgradeOfferType,
    SwordContainer,
    SwordContainerType,
    ContainedSword,
    SwordAttack,
    SwordIdentity,
    SwordSpiritCost,
    SwordSpiritPower,
    SwordReplacementSelection,
} from "../simulation/rogue/components";
import {
    RogueEnemyRenderQuery,
    RogueAutoFlyingSwordGroupQuery,
    RogueExperiencePickupQuery,
    RogueFireBurstQuery,
    RogueLightningArcQuery,
    RoguePlayerQuery,
    RogueRunQuery,
    RogueSwordInventoryQuery,
    RogueSwordReplacementSelectionQuery,
    RogueStoneGolemChargeRenderQuery,
    RogueSwordWraithEmpowermentRenderQuery,
} from "../simulation/rogue/queries";
import {
    STONE_GOLEM_CHARGE_WINDUP_TICKS,
} from "../simulation/rogue/enemy/stone-golem-charge-system";
import {
    SWORD_WRAITH_PULSE_VISUAL_TICKS,
} from "../simulation/rogue/enemy/sword-wraith-empowerment-system";
import { DemoFlyingSwordRenderQuery } from "./queries";
import type { Vector3Out } from "./types";

type Swords = QueryOf<typeof DemoFlyingSwordRenderQuery>;
type Runs = QueryOf<typeof RogueRunQuery>;
type Cultivators = QueryOf<typeof RoguePlayerQuery>;
type Enemies = QueryOf<typeof RogueEnemyRenderQuery>;
type StoneGolemCharges =
    QueryOf<typeof RogueStoneGolemChargeRenderQuery>;
type SwordWraithEmpowerments =
    QueryOf<typeof RogueSwordWraithEmpowermentRenderQuery>;
type Pickups = QueryOf<typeof RogueExperiencePickupQuery>;
type DamageDisplays = QueryOf<typeof DamageDisplayQuery>;
type LightningArcs = QueryOf<typeof RogueLightningArcQuery>;
type FireBursts = QueryOf<typeof RogueFireBurstQuery>;
type SwordBuilds = QueryOf<typeof RogueAutoFlyingSwordGroupQuery>;
type SwordGroups = QueryOf<typeof FlyingSwordGroupQuery>;
type ReplacementSelections =
    QueryOf<typeof RogueSwordReplacementSelectionQuery>;
type SwordInventory = QueryOf<typeof RogueSwordInventoryQuery>;

enum RenderKind {
    SwordShadow,
    ActorShadow,
    Cultivator,
    Enemy,
    Experience,
    Sword,
    FusionAura,
    LightningArc,
    FireBurst,
    Damage,
}

interface DemoRenderItem extends DepthRenderItem {
    kind: RenderKind;
    sprite: number;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    colorIndex: number;
    color: string;
    width: number;
    height: number;
    health: number;
    amount: number;
    alpha: number;
    style: number;
    targeted: number;
    flash: number;
    empowered: number;
    trailX: number;
    trailY: number;
    trailStrength: number;
}

/** 示例专属 PixiJS/WebGL 表现后端。 */
export class DemoRenderService extends Service {
    @Inject.world() private readonly world!: World;
    @Inject.resource(DemoViewResource) private readonly view!: DemoViewResource;
    @Inject.resource(DemoPixiResource)
    private readonly pixi!: DemoPixiResource;
    @Inject.service(FlyingSwordSkillService)
    private readonly skills!: FlyingSwordSkillService;
    @Inject.resource(RogueUpgradeCatalog)
    private readonly upgrades!: RogueUpgradeCatalog;
    @Inject.resource(SwordBlueprintCatalog)
    private readonly swordBlueprints!: SwordBlueprintCatalog;
    @Inject.resource(FlyingSwordFormationCatalog)
    private readonly formations!: FlyingSwordFormationCatalog;

    private readonly logicalWidth = 960;
    private readonly logicalHeight = 640;
    private readonly camera = new TopDownOrthographicCamera({
        viewportWidth: this.logicalWidth,
        viewportHeight: this.logicalHeight,
        elevation: degreesToRadians(30),
        yaw: degreesToRadians(45),
        zoom: 62,
        target: { x: 0, y: 0.9, z: 2.2 },
    });
    private readonly queue = new DepthRenderQueue<DemoRenderItem>(() => ({
        kind: RenderKind.Sword,
        sprite: 0,
        layer: DemoRenderLayer.World,
        depth: 0,
        subOrder: 0,
        stableId: 0,
        x1: 0,
        y1: 0,
        x2: 0,
        y2: 0,
        colorIndex: 0,
        color: "#ffffff",
        width: 0,
        height: 0,
        health: 1,
        amount: 0,
        alpha: 1,
        style: DamageDisplayStyle.Dealt,
        targeted: 0,
        flash: 0,
        empowered: 0,
        trailX: 0,
        trailY: 0,
        trailStrength: 0,
    }));
    private readonly swordSprites: SwordSprite[] = [];
    private readonly actorSprites: ActorSprite[] = [];
    private readonly projected: ProjectedPoint = { x: 0, y: 0, depth: 0 };
    private readonly projectedSecond: ProjectedPoint = { x: 0, y: 0, depth: 0 };
    private readonly clientPoint = { x: 0, y: 0 };
    private readonly formationSample: FlyingSwordFormationRouteSample = {
        x: 0,
        y: 0,
        z: 0,
        tangentX: 0,
        tangentY: 0,
        tangentZ: 1,
    };
    private readonly formationSlot: FlyingSwordFormationSlotSample = {
        route: 0,
        routeSlot: 0,
        routeSwordCount: 1,
        phaseOffset: 0,
    };
    private readonly formationDebug =
        new URLSearchParams(window.location.search).has(
            "formationDebug",
        );
    private formationPlan: number =
        FlyingSwordFormationPlanId.EightGates;
    private formationName = "八门周天阵";
    private formationCenterX = 0;
    private formationCenterZ = 0;
    private formationRadius = 2.8;
    private formationAngularSpeed = 0.9;
    private formationSize = 1;
    private formationForwardX = 0;
    private formationForwardZ = 1;
    private readonly upgradeNames: Array<HTMLElement | null> = [
        null,
        null,
        null,
    ];
    private readonly upgradeDescriptions: Array<HTMLElement | null> = [
        null,
        null,
        null,
    ];
    private totalSwordCount = 0;
    private visibleSwordCount = 0;
    private visibleEnemyCount = 0;
    private swordTrailCount = 0;
    private lightningArcCount = 0;
    private fireBurstCount = 0;
    private coldAuraCount = 0;
    private empowermentAuraCount = 0;
    private nearestDepth = 0;
    private farthestDepth = 0;
    private minimumHeight = 0;
    private maximumHeight = 0;
    private statusCountdown = 0;
    private followedX = 0;
    private followedY = 0;
    private followedZ = 0;
    private replacementOffer = INVALID_ENTITY;

    init(): void {
        const swordTextures = this.pixi.swordTextures;
        for (let index = 0; index < swordTextures.length; index++) {
            this.swordSprites.push({ texture: swordTextures[index] });
        }
        const actorTextures = this.pixi.actorTextures;
        for (let index = 0; index < actorTextures.length; index++) {
            const definition = ACTOR_SPRITES[index];
            this.actorSprites.push({
                texture: actorTextures[index],
                width: definition.width,
                height: definition.height,
            });
        }
        for (let index = 0; index < this.view.upgradeButtons.length; index++) {
            const button = this.view.upgradeButtons[index];
            this.upgradeNames[index] = button.querySelector("strong");
            this.upgradeDescriptions[index] = button.querySelector("small");
        }
    }

    clientToGround(clientX: number, clientY: number, out: Vector3Out): boolean {
        const bounds = this.view.canvas.getBoundingClientRect();
        if (bounds.width <= 0 || bounds.height <= 0) return false;
        this.clientPoint.x = (clientX - bounds.left) * this.logicalWidth / bounds.width;
        this.clientPoint.y = (clientY - bounds.top) * this.logicalHeight / bounds.height;
        return this.camera.unprojectToHeight(
            this.clientPoint.x,
            this.clientPoint.y,
            0,
            out,
        );
    }

    render(
        interpolation: number,
        scene: Readonly<DemoSceneState>,
        runs: Runs,
        cultivators: Cultivators,
        enemies: Enemies,
        stoneGolemCharges: StoneGolemCharges,
        swordWraithEmpowerments: SwordWraithEmpowerments,
        pickups: Pickups,
        damages: DamageDisplays,
        lightningArcs: LightningArcs,
        fireBursts: FireBursts,
        swordBuilds: SwordBuilds,
        groups: SwordGroups,
        swords: Swords,
        replacementSelections: ReplacementSelections,
        swordInventory: SwordInventory,
    ): void {
        const skillPhase = this.skills.phase(scene.swordGroup);
        const tick = this.readRunTick(runs);
        const fusionActive = this.readFusionActive(cultivators);
        this.followCultivator(
            cultivators,
            scene.cultivator,
            interpolation,
        );
        this.snapshotFormation(scene, groups, cultivators);
        this.beginFrame();
        this.drawGroundGrid();
        this.drawGroundTargets(
            scene,
            runs,
            skillPhase,
            tick,
            fusionActive,
        );
        this.drawStoneGolemChargeWarnings(stoneGolemCharges, tick);
        this.drawSwordWraithEmpowermentPulses(
            swordWraithEmpowerments,
            tick,
        );
        this.queue.begin();
        this.collectCultivators(cultivators, interpolation, tick);
        this.collectEnemies(enemies, interpolation, tick);
        this.collectExperience(pickups, interpolation);
        this.collectSwords(swords, interpolation);
        this.collectDamageDisplays(
            damages,
            tick,
            interpolation,
        );
        this.collectLightningArcs(lightningArcs, tick);
        this.collectFireBursts(fireBursts, tick);
        this.queue.sort();
        this.drawSortedItems();
        if (this.statusCountdown === 0) {
        this.drawStatus(
            scene,
            runs,
            cultivators,
            swordBuilds,
            skillPhase,
        );
        this.updateSwordReplacementPanel(
            replacementSelections,
            swordInventory,
        );
            this.statusCountdown = STATUS_UPDATE_INTERVAL_FRAMES - 1;
        } else {
            this.statusCountdown--;
        }
        this.pixi.render();
    }

    private beginFrame(): void {
        this.pixi.painter.beginFrame();
        this.totalSwordCount = 0;
        this.visibleSwordCount = 0;
        this.visibleEnemyCount = 0;
        this.swordTrailCount = 0;
        this.lightningArcCount = 0;
        this.fireBurstCount = 0;
        this.coldAuraCount = 0;
        this.empowermentAuraCount = 0;
        this.nearestDepth = Number.POSITIVE_INFINITY;
        this.farthestDepth = Number.NEGATIVE_INFINITY;
        this.minimumHeight = Number.POSITIVE_INFINITY;
        this.maximumHeight = Number.NEGATIVE_INFINITY;
    }

    private drawGroundGrid(): void {
        const context = this.pixi.painter;
        context.lineWidth = 1;
        context.strokeStyle = "rgba(88, 160, 144, 0.13)";
        context.beginPath();
        const centerX = Math.floor(this.followedX);
        const centerZ = Math.floor(this.followedZ);
        const minimumX = centerX - GRID_HALF_SPAN;
        const maximumX = centerX + GRID_HALF_SPAN;
        const minimumZ = centerZ - GRID_HALF_SPAN;
        const maximumZ = centerZ + GRID_HALF_SPAN;
        for (let z = minimumZ; z <= maximumZ; z++) {
            this.camera.project(minimumX, 0, z, this.projected);
            this.camera.project(maximumX, 0, z, this.projectedSecond);
            context.moveTo(this.projected.x, this.projected.y);
            context.lineTo(this.projectedSecond.x, this.projectedSecond.y);
        }
        for (let x = minimumX; x <= maximumX; x++) {
            this.camera.project(x, 0, minimumZ, this.projected);
            this.camera.project(x, 0, maximumZ, this.projectedSecond);
            context.moveTo(this.projected.x, this.projected.y);
            context.lineTo(this.projectedSecond.x, this.projectedSecond.y);
        }
        context.stroke();
    }

    private snapshotFormation(
        scene: Readonly<DemoSceneState>,
        groups: SwordGroups,
        cultivators: Cultivators,
    ): void {
        const groupIter = groups.iter();
        while (groupIter.next()) {
            const [
                count,
                entities,
                ,
                centers,
                ,
                formation,
                ,
                ,
                plans,
            ] = groupIter.current;
            const centerXs = centers[Float3.X];
            const centerZs = centers[Float3.Z];
            const radii =
                formation[FlyingSwordFormation.OrbitRadius];
            const angularSpeeds =
                formation[FlyingSwordFormation.AngularSpeed];
            const sizes = formation[FlyingSwordFormation.Size];
            const planIds = plans[FlyingSwordFormationPlan.Plan];
            for (let row = 0; row < count; row++) {
                if (entities[row] !== scene.swordGroup) continue;
                this.formationCenterX = centerXs[row];
                this.formationCenterZ = centerZs[row];
                this.formationRadius = radii[row];
                this.formationAngularSpeed = angularSpeeds[row];
                this.formationSize = Math.max(1, sizes[row]);
                this.formationPlan = planIds[row];
                this.formationName =
                    this.formations.get(planIds[row])?.name ??
                    "未知阵图";
                break;
            }
        }

        const cultivatorIter = cultivators.iter();
        while (cultivatorIter.next()) {
            const [count, entities, , , , directions] =
                cultivatorIter.current;
            const directionXs = directions[Float3.X];
            const directionZs = directions[Float3.Z];
            for (let row = 0; row < count; row++) {
                if (entities[row] !== scene.cultivator) continue;
                const x = directionXs[row];
                const z = directionZs[row];
                const length = Math.sqrt(x * x + z * z);
                if (length > FORMATION_DIRECTION_EPSILON) {
                    this.formationForwardX = x / length;
                    this.formationForwardZ = z / length;
                }
                return;
            }
        }
    }

    private drawGroundTargets(
        scene: Readonly<DemoSceneState>,
        runs: Runs,
        skillPhase: FlyingSwordSkillPhaseValue,
        tick: number,
        fusionActive: boolean,
    ): void {
        const context = this.pixi.painter;
        if (
            !fusionActive &&
            scene.stance === FlyingSwordStance.Formation
        ) {
            this.drawFormationGroundAura(context, tick);
        }
        if (scene.hasMoveTarget) {
            this.camera.project(
                scene.moveTargetX,
                scene.moveTargetY,
                scene.moveTargetZ,
                this.projected,
            );
            drawGroundMarker(context, this.projected, "#65ddbf", 18, 8, true);
        }
        if (skillPhase === FlyingSwordSkillPhase.Idle) return;
        let targetX = scene.targetX;
        let targetY = scene.targetY;
        let targetZ = scene.targetZ;
        const iter = runs.iter();
        while (iter.next()) {
            const [count, , , , , , , , targets] = iter.current;
            if (count === 0) continue;
            targetX = targets[RogueRunTarget.SkillX][0];
            targetY = targets[RogueRunTarget.SkillY][0];
            targetZ = targets[RogueRunTarget.SkillZ][0];
            break;
        }
        this.camera.project(targetX, targetY, targetZ, this.projected);
        drawGroundMarker(
            context,
            this.projected,
            skillPhase <= FlyingSwordSkillPhase.Strike
                ? "#ffb753"
                : "rgba(255, 183, 83, 0.38)",
            22,
            10,
            false,
        );
    }

    private drawFormationGroundAura(
        context: PixiPainter,
        tick: number,
    ): void {
        const plan = this.formations.get(this.formationPlan);
        if (!plan) return;
        const pulse = 0.34 + Math.sin(tick * 0.1) * 0.05;
        const rightX = this.formationForwardZ;
        const rightZ = -this.formationForwardX;
        context.lineWidth = 1.5;
        context.strokeStyle = "#69f7d0";
        context.globalAlpha = pulse;
        for (let route = 0; route < plan.routeCount; route++) {
            const period = this.formations.routePeriod(
                plan.id,
                route,
            );
            context.beginPath();
            for (
                let sampleIndex = 0;
                sampleIndex <= FORMATION_PATH_SAMPLES;
                sampleIndex++
            ) {
                const phase =
                    period * sampleIndex / FORMATION_PATH_SAMPLES;
                this.formations.sampleRoute(
                    plan.id,
                    route,
                    phase,
                    this.formationSample,
                );
                const lateral =
                    this.formationSample.x * this.formationRadius;
                const depth =
                    this.formationSample.z * this.formationRadius;
                this.camera.project(
                    this.formationCenterX +
                        rightX * lateral +
                        this.formationForwardX * depth,
                    FORMATION_GROUND_HEIGHT,
                    this.formationCenterZ +
                        rightZ * lateral +
                        this.formationForwardZ * depth,
                    this.projected,
                );
                if (sampleIndex === 0) {
                    context.moveTo(
                        this.projected.x,
                        this.projected.y,
                    );
                } else {
                    context.lineTo(
                        this.projected.x,
                        this.projected.y,
                    );
                }
            }
            context.stroke();
        }
        if (this.formationDebug) {
            this.drawFormationDebug(context, tick);
        }
        context.globalAlpha = 1;
    }

    private drawStoneGolemChargeWarnings(
        stoneGolems: StoneGolemCharges,
        tick: number,
    ): void {
        const context = this.pixi.painter;
        let drawn = 0;
        const iter = stoneGolems.iter();
        while (
            drawn < MAX_STONE_GOLEM_CHARGE_WARNINGS &&
            iter.next()
        ) {
            const [count, , positions, charges] = iter.current;
            const xs = positions[Float3.X];
            const zs = positions[Float3.Z];
            const phases = charges[StoneGolemCharge.Phase];
            const phaseStartTicks =
                charges[StoneGolemCharge.PhaseStartTick];
            const directionXs =
                charges[StoneGolemCharge.DirectionX];
            const directionZs =
                charges[StoneGolemCharge.DirectionZ];
            for (
                let row = 0;
                row < count &&
                drawn < MAX_STONE_GOLEM_CHARGE_WARNINGS;
                row++
            ) {
                const phase = phases[row];
                if (
                    phase !== StoneGolemChargePhase.Windup &&
                    phase !== StoneGolemChargePhase.Charging
                ) {
                    continue;
                }
                const x = xs[row];
                const z = zs[row];
                const length =
                    phase === StoneGolemChargePhase.Windup ? 11 : 6;
                this.camera.project(x, 0.03, z, this.projected);
                this.camera.project(
                    x + directionXs[row] * length,
                    0.03,
                    z + directionZs[row] * length,
                    this.projectedSecond,
                );
                if (
                    Math.max(
                        this.projected.x,
                        this.projectedSecond.x,
                    ) < -32 ||
                    Math.min(
                        this.projected.x,
                        this.projectedSecond.x,
                    ) > this.logicalWidth + 32 ||
                    Math.max(
                        this.projected.y,
                        this.projectedSecond.y,
                    ) < -32 ||
                    Math.min(
                        this.projected.y,
                        this.projectedSecond.y,
                    ) > this.logicalHeight + 32
                ) {
                    continue;
                }
                const dx =
                    this.projectedSecond.x - this.projected.x;
                const dy =
                    this.projectedSecond.y - this.projected.y;
                const screenLength = Math.sqrt(dx * dx + dy * dy);
                if (screenLength < 1e-5) continue;
                const inverseLength = 1 / screenLength;
                const perpendicularX = -dy * inverseLength;
                const perpendicularY = dx * inverseLength;
                const startWidth =
                    phase === StoneGolemChargePhase.Windup ? 15 : 11;
                const endWidth =
                    phase === StoneGolemChargePhase.Windup ? 5 : 2;
                const progress = phase === StoneGolemChargePhase.Windup
                    ? Math.min(
                        1,
                        Math.max(
                            0,
                            (tick - phaseStartTicks[row]) /
                                STONE_GOLEM_CHARGE_WINDUP_TICKS,
                        ),
                    )
                    : 1;
                context.globalAlpha =
                    phase === StoneGolemChargePhase.Windup
                        ? 0.12 + progress * 0.18
                        : 0.26;
                context.fillStyle =
                    phase === StoneGolemChargePhase.Windup
                        ? "#ffb24b"
                        : "#ff6b35";
                context.beginPath();
                context.moveTo(
                    this.projected.x +
                        perpendicularX * startWidth,
                    this.projected.y +
                        perpendicularY * startWidth,
                );
                context.lineTo(
                    this.projectedSecond.x +
                        perpendicularX * endWidth,
                    this.projectedSecond.y +
                        perpendicularY * endWidth,
                );
                context.lineTo(
                    this.projectedSecond.x -
                        perpendicularX * endWidth,
                    this.projectedSecond.y -
                        perpendicularY * endWidth,
                );
                context.lineTo(
                    this.projected.x -
                        perpendicularX * startWidth,
                    this.projected.y -
                        perpendicularY * startWidth,
                );
                context.closePath();
                context.fill();
                context.globalAlpha =
                    phase === StoneGolemChargePhase.Windup
                        ? 0.45 + progress * 0.45
                        : 0.9;
                context.strokeStyle =
                    phase === StoneGolemChargePhase.Windup
                        ? "#ffd37a"
                        : "#fff0b3";
                context.lineWidth =
                    phase === StoneGolemChargePhase.Windup ? 2 : 3;
                context.setLineDash(
                    phase === StoneGolemChargePhase.Windup
                        ? STONE_GOLEM_WARNING_DASH
                        : SOLID_LINE_DASH,
                );
                context.beginPath();
                context.moveTo(this.projected.x, this.projected.y);
                context.lineTo(
                    this.projectedSecond.x,
                    this.projectedSecond.y,
                );
                context.stroke();
                drawn++;
            }
        }
        context.setLineDash(SOLID_LINE_DASH);
        context.globalAlpha = 1;
    }

    private drawSwordWraithEmpowermentPulses(
        swordWraiths: SwordWraithEmpowerments,
        tick: number,
    ): void {
        const context = this.pixi.painter;
        let drawn = 0;
        const iter = swordWraiths.iter();
        while (
            drawn < MAX_SWORD_WRAITH_PULSES &&
            iter.next()
        ) {
            const [count, , positions, abilities] = iter.current;
            const xs = positions[Float3.X];
            const zs = positions[Float3.Z];
            const radii =
                abilities[SwordWraithEmpowerment.Radius];
            const pulseEndTicks =
                abilities[SwordWraithEmpowerment.PulseEndTick];
            for (
                let row = 0;
                row < count && drawn < MAX_SWORD_WRAITH_PULSES;
                row++
            ) {
                const remaining = pulseEndTicks[row] - tick;
                if (
                    remaining <= 0 ||
                    remaining > SWORD_WRAITH_PULSE_VISUAL_TICKS
                ) {
                    continue;
                }
                const progress =
                    1 -
                    remaining / SWORD_WRAITH_PULSE_VISUAL_TICKS;
                const radius =
                    Math.max(0, radii[row]) * Math.max(0.08, progress);
                context.strokeStyle = "#c789ff";
                context.lineWidth = 2.5 - progress;
                context.globalAlpha = (1 - progress) * 0.72;
                context.beginPath();
                for (
                    let sample = 0;
                    sample <= SWORD_WRAITH_PULSE_SAMPLES;
                    sample++
                ) {
                    const angle =
                        sample / SWORD_WRAITH_PULSE_SAMPLES *
                        Math.PI * 2;
                    this.camera.project(
                        xs[row] + Math.cos(angle) * radius,
                        0.04,
                        zs[row] + Math.sin(angle) * radius,
                        this.projected,
                    );
                    if (sample === 0) {
                        context.moveTo(
                            this.projected.x,
                            this.projected.y,
                        );
                    } else {
                        context.lineTo(
                            this.projected.x,
                            this.projected.y,
                        );
                    }
                }
                context.stroke();
                drawn++;
            }
        }
        context.globalAlpha = 1;
    }

    private drawFormationDebug(
        context: PixiPainter,
        tick: number,
    ): void {
        const slotCount = Math.min(
            this.formationSize,
            FORMATION_DEBUG_MAXIMUM_SLOTS,
        );
        const rightX = this.formationForwardZ;
        const rightZ = -this.formationForwardX;
        const basePhase =
            tick / 60 *
            this.formationAngularSpeed;
        context.fillStyle = "#d7fff5";
        context.font = "10px monospace";
        context.globalAlpha = 0.88;
        for (let slot = 0; slot < slotCount; slot++) {
            this.formations.resolveSlot(
                this.formationPlan,
                slot,
                this.formationSize,
                this.formationSlot,
            );
            this.formations.sampleRoute(
                this.formationPlan,
                this.formationSlot.route,
                basePhase + this.formationSlot.phaseOffset,
                this.formationSample,
            );
            const lateral =
                this.formationSample.x * this.formationRadius;
            const depth =
                this.formationSample.z * this.formationRadius;
            const worldX =
                this.formationCenterX +
                rightX * lateral +
                this.formationForwardX * depth;
            const worldZ =
                this.formationCenterZ +
                rightZ * lateral +
                this.formationForwardZ * depth;
            this.camera.project(
                worldX,
                FORMATION_GROUND_HEIGHT,
                worldZ,
                this.projected,
            );
            context.fillText(
                String(slot),
                this.projected.x + 3,
                this.projected.y - 3,
            );
            const tangentX =
                rightX * this.formationSample.tangentX +
                this.formationForwardX *
                    this.formationSample.tangentZ;
            const tangentZ =
                rightZ * this.formationSample.tangentX +
                this.formationForwardZ *
                    this.formationSample.tangentZ;
            this.camera.project(
                worldX + tangentX * FORMATION_DEBUG_TANGENT_LENGTH,
                FORMATION_GROUND_HEIGHT,
                worldZ + tangentZ * FORMATION_DEBUG_TANGENT_LENGTH,
                this.projectedSecond,
            );
            context.beginPath();
            context.moveTo(this.projected.x, this.projected.y);
            context.lineTo(
                this.projectedSecond.x,
                this.projectedSecond.y,
            );
            context.stroke();
        }
    }

    private readFusionActive(cultivators: Cultivators): boolean {
        const iter = cultivators.iter();
        while (iter.next()) {
            const [count, , , , , , , , , , , , actions] =
                iter.current;
            if (
                count > 0 &&
                actions[SwordBodyUnity.Active][0] !== 0
            ) {
                return true;
            }
        }
        return false;
    }

    private followCultivator(
        cultivators: Cultivators,
        entity: number,
        interpolation: number,
    ): void {
        const iter = cultivators.iter();
        while (iter.next()) {
            const [count, entities, positions, previousPositions] =
                iter.current;
            const previousXs = previousPositions[Float3.X];
            const previousYs = previousPositions[Float3.Y];
            const previousZs = previousPositions[Float3.Z];
            const xs = positions[Float3.X];
            const ys = positions[Float3.Y];
            const zs = positions[Float3.Z];
            for (let row = 0; row < count; row++) {
                if (entities[row] !== entity) continue;
                this.followedX = lerp(previousXs[row], xs[row], interpolation);
                this.followedY = lerp(previousYs[row], ys[row], interpolation);
                this.followedZ = lerp(previousZs[row], zs[row], interpolation);
                this.camera.setTargetPosition(
                    this.followedX,
                    this.followedY + CAMERA_TARGET_HEIGHT,
                    this.followedZ + CAMERA_TARGET_FORWARD_OFFSET,
                );
                return;
            }
        }
    }

    private collectCultivators(
        cultivators: Cultivators,
        interpolation: number,
        tick: number,
    ): void {
        const iter = cultivators.iter();
        while (iter.next()) {
            const [
                count,
                entities,
                positions,
                previousPositions,
                ,
                ,
                ,
                ,
                ,
                ,
                ,
                ,
                actions,
            ] = iter.current;
            const previousXs = previousPositions[Float3.X];
            const previousYs = previousPositions[Float3.Y];
            const previousZs = previousPositions[Float3.Z];
            const xs = positions[Float3.X];
            const ys = positions[Float3.Y];
            const zs = positions[Float3.Z];
            const active = actions[SwordBodyUnity.Active];
            const startTicks = actions[SwordBodyUnity.StartTick];
            for (let row = 0; row < count; row++) {
                const x = lerp(previousXs[row], xs[row], interpolation);
                const y = lerp(previousYs[row], ys[row], interpolation);
                const z = lerp(previousZs[row], zs[row], interpolation);
                this.camera.project(x, y, z, this.projected);
                if (!this.isVisible(this.projected.x, this.projected.y)) {
                    continue;
                }
                const shadow = this.queue.acquire();
                shadow.kind = RenderKind.ActorShadow;
                shadow.sprite = 0;
                shadow.layer = DemoRenderLayer.Shadow;
                shadow.depth = this.projected.depth;
                shadow.subOrder = 0;
                shadow.stableId = entities[row] * 8;
                shadow.x1 = this.projected.x;
                shadow.y1 = this.projected.y + 2;
                shadow.width = 38;
                shadow.height = 12;

                const item = this.queue.acquire();
                item.kind = RenderKind.Cultivator;
                item.sprite = 0;
                item.layer = DemoRenderLayer.World;
                item.depth = this.projected.depth;
                item.subOrder = 0;
                item.stableId = entities[row] * 8 + 1;
                item.x1 = this.projected.x;
                item.y1 = this.projected.y;
                item.width = CULTIVATOR_WIDTH;
                item.height = CULTIVATOR_HEIGHT;
                item.color = "#c9f5e7";
                if (active[row] !== 0) {
                    const currentX = this.projected.x;
                    const currentY = this.projected.y;
                    const currentDepth = this.projected.depth;
                    this.camera.project(
                        previousXs[row],
                        previousYs[row],
                        previousZs[row],
                        this.projectedSecond,
                    );
                    const aura = this.queue.acquire();
                    aura.kind = RenderKind.FusionAura;
                    aura.sprite = 0;
                    aura.layer = DemoRenderLayer.ForegroundEffect;
                    aura.depth = currentDepth;
                    aura.subOrder = 0;
                    aura.stableId = entities[row] * 8 + 2;
                    aura.x1 = currentX;
                    aura.y1 = currentY;
                    aura.x2 = this.projectedSecond.x;
                    aura.y2 = this.projectedSecond.y;
                    aura.amount =
                        tick + interpolation - startTicks[row];
                }
            }
        }
    }

    private collectEnemies(
        enemies: Enemies,
        interpolation: number,
        tick: number,
    ): void {
        const iter = enemies.iter();
        while (iter.next()) {
            const [
                count,
                entities,
                positions,
                previousPositions,
                identities,
                bodies,
                health,
                feedback,
                cold,
                empowerment,
            ] = iter.current;
            const previousXs = previousPositions[Float3.X];
            const previousYs = previousPositions[Float3.Y];
            const previousZs = previousPositions[Float3.Z];
            const xs = positions[Float3.X];
            const ys = positions[Float3.Y];
            const zs = positions[Float3.Z];
            const visuals = identities[EnemyIdentity.Visual];
            const radii = bodies[EnemyBody.Radius];
            const currentHealth = health[Health.Current];
            const maximumHealth = health[Health.Maximum];
            const targeted =
                feedback[EnemyFeedback.TargetedSwordCount];
            const flashEndTicks =
                feedback[EnemyFeedback.HitFlashEndTick];
            const hitKinds = feedback[EnemyFeedback.HitKind];
            const coldStacks =
                cold[EnemyColdAccumulation.Stacks];
            const empowermentExpireTicks =
                empowerment[EnemyEmpowerment.ExpireTick];
            for (let row = 0; row < count; row++) {
                if (currentHealth[row] <= 0) continue;
                const x = lerp(previousXs[row], xs[row], interpolation);
                const y = lerp(previousYs[row], ys[row], interpolation);
                const z = lerp(previousZs[row], zs[row], interpolation);
                this.camera.project(x, y, z, this.projected);
                if (!this.isVisible(this.projected.x, this.projected.y)) {
                    continue;
                }
                const entity = entities[row];
                const radius = radii[row];
                const shadow = this.queue.acquire();
                shadow.kind = RenderKind.ActorShadow;
                shadow.sprite = 0;
                shadow.layer = DemoRenderLayer.Shadow;
                shadow.depth = this.projected.depth;
                shadow.subOrder = 0;
                shadow.stableId = entity * 8;
                shadow.x1 = this.projected.x;
                shadow.y1 = this.projected.y + 2;
                shadow.width = 34 + radius * 24;
                shadow.height = 10 + radius * 7;

                const item = this.queue.acquire();
                item.kind = RenderKind.Enemy;
                item.sprite = 1 + visuals[row] % (this.actorSprites.length - 1);
                item.layer = DemoRenderLayer.World;
                item.depth = this.projected.depth;
                item.subOrder = 0;
                item.stableId = entity * 8 + 1;
                item.x1 = this.projected.x;
                item.y1 = this.projected.y;
                const sprite = this.actorSprites[item.sprite];
                item.width = sprite.width;
                item.height = sprite.height;
                item.health = maximumHealth[row] > 0
                    ? currentHealth[row] / maximumHealth[row]
                    : 0;
                item.targeted = targeted[row];
                item.flash = tick + interpolation < flashEndTicks[row]
                    ? 1
                    : 0;
                item.style = hitKinds[row];
                if (
                    coldStacks[row] > 0 &&
                    this.coldAuraCount < MAX_COLD_AURAS
                ) {
                    item.amount = coldStacks[row];
                    this.coldAuraCount++;
                } else {
                    item.amount = 0;
                }
                if (
                    tick < empowermentExpireTicks[row] &&
                    this.empowermentAuraCount <
                        MAX_ENEMY_EMPOWERMENT_AURAS
                ) {
                    item.empowered = 1;
                    this.empowermentAuraCount++;
                } else {
                    item.empowered = 0;
                }
                this.visibleEnemyCount++;
            }
        }
    }

    private collectExperience(
        pickups: Pickups,
        interpolation: number,
    ): void {
        const iter = pickups.iter();
        while (iter.next()) {
            const [
                count,
                entities,
                positions,
                previousPositions,
                ,
                values,
            ] = iter.current;
            const previousXs = previousPositions[Float3.X];
            const previousYs = previousPositions[Float3.Y];
            const previousZs = previousPositions[Float3.Z];
            const xs = positions[Float3.X];
            const ys = positions[Float3.Y];
            const zs = positions[Float3.Z];
            const experience = values[ExperiencePickup.Value];
            for (let row = 0; row < count; row++) {
                const x = lerp(previousXs[row], xs[row], interpolation);
                const y = lerp(previousYs[row], ys[row], interpolation);
                const z = lerp(previousZs[row], zs[row], interpolation);
                this.camera.project(x, y, z, this.projected);
                if (!this.isVisible(this.projected.x, this.projected.y)) {
                    continue;
                }
                const item = this.queue.acquire();
                item.kind = RenderKind.Experience;
                item.sprite = 0;
                item.layer = DemoRenderLayer.World;
                item.depth = this.projected.depth;
                item.subOrder = 1;
                item.stableId = entities[row] * 8 + 4;
                item.x1 = this.projected.x;
                item.y1 = this.projected.y;
                item.width = Math.min(12, 5 + experience[row] * 0.35);
                item.height = item.width;
            }
        }
    }

    private isVisible(x: number, y: number): boolean {
        return !(
            x < -VIEW_CULLING_MARGIN ||
            x > this.logicalWidth + VIEW_CULLING_MARGIN ||
            y < -VIEW_CULLING_MARGIN ||
            y > this.logicalHeight + VIEW_CULLING_MARGIN
        );
    }

    private collectSwords(swords: Swords, interpolation: number): void {
        const iter = swords.iter();
        while (iter.next()) {
            const [
                count,
                entities,
                ,
                previousPositions,
                positions,
                directions,
                visuals,
            ] = iter.current;
            const previousXs = previousPositions[Float3.X];
            const previousYs = previousPositions[Float3.Y];
            const previousZs = previousPositions[Float3.Z];
            const xs = positions[Float3.X];
            const ys = positions[Float3.Y];
            const zs = positions[Float3.Z];
            const forwardXs = directions[Float3.X];
            const forwardYs = directions[Float3.Y];
            const forwardZs = directions[Float3.Z];
            const visualIds = visuals[FlyingSwordVisual.Id];
            for (let row = 0; row < count; row++) {
                const x = lerp(
                    previousXs[row],
                    xs[row],
                    interpolation,
                );
                const y = lerp(
                    previousYs[row],
                    ys[row],
                    interpolation,
                );
                const z = lerp(
                    previousZs[row],
                    zs[row],
                    interpolation,
                );
                this.totalSwordCount++;
                this.camera.project(x, y, z, this.projected);
                if (!this.isVisible(this.projected.x, this.projected.y)) {
                    continue;
                }
                const centerScreenX = this.projected.x;
                const centerScreenY = this.projected.y;

                const forwardX = forwardXs[row];
                const forwardY = forwardYs[row];
                const forwardZ = forwardZs[row];
                const entity = entities[row];
                const visualId = visualIds[row];
                const spriteIndex = visualId % this.swordSprites.length;
                const colorIndex = visualId % SWORD_COLORS.length;

                const horizontalLength = Math.sqrt(
                    forwardX * forwardX + forwardZ * forwardZ,
                );
                const shadowForwardX = horizontalLength > 1e-5
                    ? forwardX / horizontalLength
                    : 0;
                const shadowForwardZ = horizontalLength > 1e-5
                    ? forwardZ / horizontalLength
                    : 1;
                const shadowHalfLength = 0.62;
                this.camera.project(
                    x - shadowForwardX * shadowHalfLength,
                    0,
                    z - shadowForwardZ * shadowHalfLength,
                    this.projected,
                );
                this.camera.project(
                    x + shadowForwardX * shadowHalfLength,
                    0,
                    z + shadowForwardZ * shadowHalfLength,
                    this.projectedSecond,
                );
                const shadow = this.queue.acquire();
                shadow.kind = RenderKind.SwordShadow;
                shadow.sprite = spriteIndex;
                shadow.layer = DemoRenderLayer.Shadow;
                shadow.depth = (this.projected.depth + this.projectedSecond.depth) * 0.5;
                shadow.subOrder = 0;
                shadow.stableId = entity * 4;
                shadow.x1 = this.projected.x;
                shadow.y1 = this.projected.y;
                shadow.x2 = this.projectedSecond.x;
                shadow.y2 = this.projectedSecond.y;
                shadow.color = "rgba(0, 0, 0, 0.36)";

                const halfLength = 0.62;
                this.camera.project(
                    x - forwardX * halfLength,
                    y - forwardY * halfLength,
                    z - forwardZ * halfLength,
                    this.projected,
                );
                this.camera.project(
                    x + forwardX * halfLength,
                    y + forwardY * halfLength,
                    z + forwardZ * halfLength,
                    this.projectedSecond,
                );
                const sword = this.queue.acquire();
                sword.kind = RenderKind.Sword;
                sword.sprite = spriteIndex;
                sword.layer = DemoRenderLayer.World;
                sword.depth = (this.projected.depth + this.projectedSecond.depth) * 0.5;
                sword.subOrder = 1;
                sword.stableId = entity * 4 + 1;
                sword.x1 = this.projected.x;
                sword.y1 = this.projected.y;
                sword.x2 = this.projectedSecond.x;
                sword.y2 = this.projectedSecond.y;
                sword.colorIndex = colorIndex;
                sword.color = SWORD_COLORS[colorIndex];
                const movementX = xs[row] - previousXs[row];
                const movementY = ys[row] - previousYs[row];
                const movementZ = zs[row] - previousZs[row];
                const movementSquared =
                    movementX * movementX +
                    movementY * movementY +
                    movementZ * movementZ;
                if (
                    movementSquared > SWORD_TRAIL_MINIMUM_DISTANCE_SQUARED &&
                    this.swordTrailCount < MAX_SWORD_TRAILS
                ) {
                    this.camera.project(
                        previousXs[row],
                        previousYs[row],
                        previousZs[row],
                        this.projected,
                    );
                    sword.trailX = this.projected.x;
                    sword.trailY = this.projected.y;
                    sword.trailStrength = Math.min(
                        1,
                        Math.sqrt(movementSquared) * 2.5,
                    );
                    this.swordTrailCount++;
                } else {
                    sword.trailX = centerScreenX;
                    sword.trailY = centerScreenY;
                    sword.trailStrength = 0;
                }
                this.visibleSwordCount++;
                this.nearestDepth = Math.min(this.nearestDepth, sword.depth);
                this.farthestDepth = Math.max(this.farthestDepth, sword.depth);
                this.minimumHeight = Math.min(this.minimumHeight, y);
                this.maximumHeight = Math.max(this.maximumHeight, y);
            }
        }
    }

    private collectDamageDisplays(
        displays: DamageDisplays,
        tick: number,
        interpolation: number,
    ): void {
        const iter = displays.iter();
        while (iter.next()) {
            const [count, entities, positions, data] = iter.current;
            const xs = positions[Float3.X];
            const ys = positions[Float3.Y];
            const zs = positions[Float3.Z];
            const amounts = data[DamageDisplay.Amount];
            const startTicks = data[DamageDisplay.StartTick];
            const durations = data[DamageDisplay.DurationTicks];
            const styles = data[DamageDisplay.Style];
            const offsets = data[DamageDisplay.HorizontalOffset];
            for (let row = 0; row < count; row++) {
                const duration = Math.max(1, durations[row]);
                const progress = Math.max(
                    0,
                    Math.min(
                        1,
                        (tick + interpolation - startTicks[row]) /
                            duration,
                    ),
                );
                this.camera.project(
                    xs[row] + offsets[row],
                    ys[row] + progress * 0.9,
                    zs[row],
                    this.projected,
                );
                if (!this.isVisible(this.projected.x, this.projected.y)) {
                    continue;
                }
                const item = this.queue.acquire();
                item.kind = RenderKind.Damage;
                item.sprite = 0;
                item.layer = DemoRenderLayer.ForegroundEffect;
                item.depth = this.projected.depth;
                item.subOrder = 0;
                item.stableId = entities[row];
                item.x1 = this.projected.x;
                item.y1 = this.projected.y;
                item.amount = amounts[row];
                item.alpha = 1 - progress * progress;
                item.style = styles[row];
            }
        }
    }

    private collectLightningArcs(
        arcs: LightningArcs,
        tick: number,
    ): void {
        const iter = arcs.iter();
        while (iter.next()) {
            const [count, entities, timing, starts, ends] =
                iter.current;
            const startTicks = timing[LightningArc.StartTick];
            const durations = timing[LightningArc.DurationTicks];
            const startXs = starts[Float3.X];
            const startYs = starts[Float3.Y];
            const startZs = starts[Float3.Z];
            const endXs = ends[Float3.X];
            const endYs = ends[Float3.Y];
            const endZs = ends[Float3.Z];
            for (let row = 0; row < count; row++) {
                if (this.lightningArcCount >= MAX_LIGHTNING_ARCS) {
                    return;
                }
                const duration = Math.max(1, durations[row]);
                const progress = Math.max(
                    0,
                    Math.min(
                        1,
                        (tick - startTicks[row]) / duration,
                    ),
                );
                this.camera.project(
                    startXs[row],
                    startYs[row],
                    startZs[row],
                    this.projected,
                );
                this.camera.project(
                    endXs[row],
                    endYs[row],
                    endZs[row],
                    this.projectedSecond,
                );
                if (
                    Math.max(this.projected.x, this.projectedSecond.x) <
                        -LIGHTNING_ARC_CULL_PADDING ||
                    Math.min(this.projected.x, this.projectedSecond.x) >
                        this.logicalWidth +
                            LIGHTNING_ARC_CULL_PADDING ||
                    Math.max(this.projected.y, this.projectedSecond.y) <
                        -LIGHTNING_ARC_CULL_PADDING ||
                    Math.min(this.projected.y, this.projectedSecond.y) >
                        this.logicalHeight +
                            LIGHTNING_ARC_CULL_PADDING
                ) {
                    continue;
                }
                const item = this.queue.acquire();
                this.lightningArcCount++;
                item.kind = RenderKind.LightningArc;
                item.sprite = 0;
                item.layer = DemoRenderLayer.ForegroundEffect;
                item.depth =
                    (this.projected.depth +
                        this.projectedSecond.depth) * 0.5;
                item.subOrder = -1;
                item.stableId = entities[row];
                item.x1 = this.projected.x;
                item.y1 = this.projected.y;
                item.x2 = this.projectedSecond.x;
                item.y2 = this.projectedSecond.y;
                item.alpha = 1 - progress;
                item.style = tick;
            }
        }
    }

    private collectFireBursts(
        bursts: FireBursts,
        tick: number,
    ): void {
        const iter = bursts.iter();
        while (iter.next()) {
            const [count, entities, positions, timing] =
                iter.current;
            const xs = positions[Float3.X];
            const ys = positions[Float3.Y];
            const zs = positions[Float3.Z];
            const startTicks = timing[FireBurst.StartTick];
            const durations = timing[FireBurst.DurationTicks];
            const radii = timing[FireBurst.Radius];
            for (let row = 0; row < count; row++) {
                if (this.fireBurstCount >= MAX_FIRE_BURSTS) return;
                const duration = Math.max(1, durations[row]);
                const progress = Math.max(
                    0,
                    Math.min(
                        1,
                        (tick - startTicks[row]) / duration,
                    ),
                );
                const diameter =
                    radii[row] *
                    FIRE_BURST_PIXELS_PER_WORLD_UNIT *
                    (0.45 + Math.sqrt(progress) * 0.55) *
                    2;
                this.camera.project(
                    xs[row],
                    ys[row],
                    zs[row],
                    this.projected,
                );
                const halfWidth = diameter * 0.5;
                const halfHeight = halfWidth * 0.62;
                if (
                    this.projected.x + halfWidth < 0 ||
                    this.projected.x - halfWidth >
                        this.logicalWidth ||
                    this.projected.y + halfHeight < 0 ||
                    this.projected.y - halfHeight >
                        this.logicalHeight
                ) {
                    continue;
                }
                const item = this.queue.acquire();
                this.fireBurstCount++;
                item.kind = RenderKind.FireBurst;
                item.sprite = 0;
                item.layer = DemoRenderLayer.ForegroundEffect;
                item.depth = this.projected.depth;
                item.subOrder = -2;
                item.stableId = entities[row];
                item.x1 = this.projected.x;
                item.y1 = this.projected.y;
                item.width = diameter;
                item.height = diameter * 0.62;
                item.amount = progress;
                item.alpha = 1 - progress;
            }
        }
    }

    private readRunTick(runs: Runs): number {
        const iter = runs.iter();
        while (iter.next()) {
            const [count, , , clocks] = iter.current;
            if (count > 0) return clocks[RogueRunClock.Tick][0];
        }
        return 0;
    }

    private drawSortedItems(): void {
        const context = this.pixi.painter;
        const items = this.queue.items;
        const length = this.queue.length;
        for (let index = 0; index < length; index++) {
            const item = items[index];
            if (item.kind === RenderKind.SwordShadow) {
                const sprite = this.swordSprites[item.sprite];
                if (sprite) {
                    drawSwordSprite(context, item, sprite, true);
                } else {
                    drawSwordFallback(context, item, true);
                }
            } else if (item.kind === RenderKind.ActorShadow) {
                context.fillStyle = "rgba(0, 0, 0, 0.32)";
                context.beginPath();
                context.ellipse(
                    item.x1,
                    item.y1,
                    item.width * 0.5,
                    item.height * 0.5,
                    0,
                    0,
                    Math.PI * 2,
                );
                context.fill();
            } else if (item.kind === RenderKind.Cultivator) {
                drawActorSprite(
                    context,
                    item,
                    this.actorSprites[item.sprite],
                );
            } else if (item.kind === RenderKind.Enemy) {
                if (item.targeted > 0) {
                    drawEnemyTargetIndicator(context, item);
                }
                if (item.amount > 0) {
                    drawEnemyColdAura(context, item);
                }
                if (item.empowered !== 0) {
                    drawEnemyEmpowermentAura(context, item);
                }
                drawActorSprite(
                    context,
                    item,
                    this.actorSprites[item.sprite],
                );
                if (item.flash !== 0) {
                    context.globalAlpha = 0.72;
                    context.effectTint = hitFlashTint(item.style);
                    drawActorSprite(
                        context,
                        item,
                        this.actorSprites[item.sprite],
                    );
                    context.effectTint = null;
                    context.globalAlpha = 1;
                }
                if (item.health < 0.999) drawEnemyHealth(context, item);
            } else if (item.kind === RenderKind.Experience) {
                drawExperience(context, item);
            } else if (item.kind === RenderKind.Sword) {
                if (item.trailStrength > 0) {
                    drawSwordTrail(context, item);
                }
                const sprite = this.swordSprites[item.sprite];
                if (sprite) {
                    drawSwordSprite(context, item, sprite);
                } else {
                    drawSwordFallback(context, item);
                }
            } else if (item.kind === RenderKind.FusionAura) {
                drawFusionAura(context, item);
            } else if (item.kind === RenderKind.LightningArc) {
                drawLightningArc(context, item);
            } else if (item.kind === RenderKind.FireBurst) {
                drawFireBurst(context, item);
            } else if (item.kind === RenderKind.Damage) {
                drawDamageDisplay(context, item);
            }
        }
    }

    private drawStatus(
        scene: Readonly<DemoSceneState>,
        runs: Runs,
        cultivators: Cultivators,
        swordBuilds: SwordBuilds,
        skillPhase: FlyingSwordSkillPhaseValue,
    ): void {
        let tick = 0;
        let kills = 0;
        let activeEnemies = 0;
        let swordCapacity = 0;
        let runPhase = RogueRunPhase.Playing;
        let upgradeActive = false;
        let upgradeA = 0;
        let upgradeB = 1;
        let upgradeC = 2;
        let offeredBlueprint = 0;
        let offeredQuality = 1;
        let offeredRecommendation = 0;
        let offeredMinimumDamage = 0;
        let offeredMaximumDamage = 0;
        let offeredAttackInterval = 0;
        let offeredMaximumSpeed = 0;
        let offeredAcceleration = 0;
        let offeredMaximumSpirit = 0;
        let offeredSpiritRecovery = 0;
        let offeredScatterSpiritCost = 0;
        let offeredFocusSpiritCost = 0;
        let offeredFormationSpiritDrain = 0;
        const runIter = runs.iter();
        while (runIter.next()) {
            const [
                count,
                ,
                identities,
                clocks,
                statuses,
                ,
                statistics,
                ,
                ,
                selection,
            ] = runIter.current;
            if (count === 0) continue;
            tick = clocks[RogueRunClock.Tick][0];
            runPhase = statuses[RogueRunStatus.Phase][0];
            kills = statistics[RogueRunStatistics.Kills][0];
            activeEnemies =
                statistics[RogueRunStatistics.ActiveEnemies][0];
            const swordContainer =
                identities[RogueRunIdentity.SwordContainer][0];
            swordCapacity = this.world.get(
                swordContainer,
                SwordContainerType,
                SwordContainer.Capacity,
            ) ?? 0;
            upgradeActive =
                selection[UpgradeSelection.Active][0] !== 0;
            upgradeA = selection[UpgradeSelection.OptionA][0];
            upgradeB = selection[UpgradeSelection.OptionB][0];
            upgradeC = selection[UpgradeSelection.OptionC][0];
            const swordOffer =
                selection[UpgradeSelection.SwordOffer][0];
            offeredBlueprint = this.world.get(
                swordOffer,
                SwordUpgradeOfferType,
                SwordUpgradeOffer.Blueprint,
            ) ?? 0;
            offeredQuality = this.world.get(
                swordOffer,
                SwordUpgradeOfferType,
                SwordUpgradeOffer.Quality,
            ) ?? 1;
            offeredRecommendation = this.world.get(
                swordOffer,
                SwordUpgradeOfferType,
                SwordUpgradeOffer.Recommendation,
            ) ?? 0;
            offeredMinimumDamage = this.world.get(
                swordOffer,
                SwordUpgradeOfferType,
                SwordUpgradeOffer.MinimumDamage,
            ) ?? 0;
            offeredMaximumDamage = this.world.get(
                swordOffer,
                SwordUpgradeOfferType,
                SwordUpgradeOffer.MaximumDamage,
            ) ?? 0;
            offeredAttackInterval = this.world.get(
                swordOffer,
                SwordUpgradeOfferType,
                SwordUpgradeOffer.AttackIntervalTicks,
            ) ?? 0;
            offeredMaximumSpeed = this.world.get(
                swordOffer,
                SwordUpgradeOfferType,
                SwordUpgradeOffer.MaximumSpeed,
            ) ?? 0;
            offeredAcceleration = this.world.get(
                swordOffer,
                SwordUpgradeOfferType,
                SwordUpgradeOffer.Acceleration,
            ) ?? 0;
            offeredMaximumSpirit = this.world.get(
                swordOffer,
                SwordUpgradeOfferType,
                SwordUpgradeOffer.MaximumSpiritPower,
            ) ?? 0;
            offeredSpiritRecovery = this.world.get(
                swordOffer,
                SwordUpgradeOfferType,
                SwordUpgradeOffer.SpiritRecoveryPerSecond,
            ) ?? 0;
            offeredScatterSpiritCost = this.world.get(
                swordOffer,
                SwordUpgradeOfferType,
                SwordUpgradeOffer.ScatterSpiritCost,
            ) ?? 0;
            offeredFocusSpiritCost = this.world.get(
                swordOffer,
                SwordUpgradeOfferType,
                SwordUpgradeOffer.FocusSpiritCost,
            ) ?? 0;
            offeredFormationSpiritDrain = this.world.get(
                swordOffer,
                SwordUpgradeOfferType,
                SwordUpgradeOffer.FormationSpiritDrainPerSecond,
            ) ?? 0;
            break;
        }
        let health = 0;
        let maximumHealth = 1;
        let level = 1;
        let experience = 0;
        let requiredExperience = 1;
        let fusionActive = false;
        let stamina = 0;
        let maximumStamina = 1;
        let restartStamina = 0;
        let mana = 0;
        let maximumMana = 1;
        let controlLimit = 0;
        let lightningChainCount = 0;
        let lightningDamageMultiplier = 0;
        let metalMaximumMomentum = 0;
        let metalDamagePerMomentum = 0;
        let fireBurstThreshold = 0;
        let fireBurstDamageMultiplier = 0;
        let coldMaximumStacks = 0;
        let coldSlowPerStack = 0;
        const cultivatorIter = cultivators.iter();
        while (cultivatorIter.next()) {
            const [
                count,
                ,
                ,
                ,
                ,
                ,
                ,
                ,
                healthData,
                ,
                levelData,
                ,
                actionData,
                staminaData,
                manaData,
                spiritualData,
            ] = cultivatorIter.current;
            if (count === 0) continue;
            health = healthData[Health.Current][0];
            maximumHealth = healthData[Health.Maximum][0];
            level = levelData[LevelExperience.Level][0];
            experience = levelData[LevelExperience.Current][0];
            requiredExperience =
                levelData[LevelExperience.Required][0];
            fusionActive =
                actionData[SwordBodyUnity.Active][0] !== 0;
            stamina = staminaData[PlayerStamina.Current][0];
            maximumStamina =
                staminaData[PlayerStamina.Maximum][0];
            restartStamina =
                staminaData[PlayerStamina.RestartThreshold][0];
            mana = manaData[PlayerMana.Current][0];
            maximumMana = manaData[PlayerMana.Maximum][0];
            controlLimit =
                spiritualData[SpiritualSense.Base][0] +
                spiritualData[SpiritualSense.Bonus][0];
            break;
        }
        const buildIter = swordBuilds.iter();
        while (buildIter.next()) {
            const [
                count,
                entities,
                ,
                lightning,
                metal,
                fire,
                cold,
            ] = buildIter.current;
            const chainCounts =
                lightning[LightningSwordIntent.ChainCount];
            const damageMultipliers =
                lightning[LightningSwordIntent.DamageMultiplier];
            const maximumMomentum =
                metal[MetalSwordIntent.MaximumMomentum];
            const damagePerMomentum =
                metal[MetalSwordIntent.DamagePerMomentum];
            const burstThresholds =
                fire[FireSwordIntent.BurstThreshold];
            const burstDamageMultipliers =
                fire[FireSwordIntent.BurstDamageMultiplier];
            const maximumColdStacks =
                cold[ColdSwordIntent.MaximumStacks];
            const slowPerColdStack =
                cold[ColdSwordIntent.SlowPerStack];
            for (let row = 0; row < count; row++) {
                if (entities[row] !== scene.swordGroup) continue;
                lightningChainCount = chainCounts[row];
                lightningDamageMultiplier = damageMultipliers[row];
                metalMaximumMomentum = maximumMomentum[row];
                metalDamagePerMomentum = damagePerMomentum[row];
                fireBurstThreshold = burstThresholds[row];
                fireBurstDamageMultiplier =
                    burstDamageMultipliers[row];
                coldMaximumStacks = maximumColdStacks[row];
                coldSlowPerStack = slowPerColdStack[row];
                break;
            }
        }

        this.view.healthFill.style.width =
            `${Math.max(0, Math.min(100, health / maximumHealth * 100))}%`;
        this.view.experienceFill.style.width =
            `${Math.max(
                0,
                Math.min(100, experience / requiredExperience * 100),
            )}%`;
        this.view.staminaFill.style.width =
            `${Math.max(
                0,
                Math.min(100, stamina / maximumStamina * 100),
            )}%`;
        this.view.level.textContent = `炼气 ${level} 层`;
        this.view.skill.dataset.ready = String(
            !fusionActive && stamina >= restartStamina,
        );
        this.view.skill.textContent = fusionActive
            ? `身剑合一 · ${Math.ceil(stamina)}`
            : stamina >= restartStamina
                ? "长按空格 · 身剑合一"
                : `体力恢复 ${Math.ceil(stamina)}/${Math.ceil(
                    restartStamina,
                )}`;
        this.view.elapsed.textContent = formatRunTime(tick);
        this.view.kills.textContent = String(kills);
        this.view.enemyCount.textContent = String(activeEnemies);
        this.view.formation.textContent =
            scene.stance === FlyingSwordStance.Formation
                ? this.formationName
                : scene.mode === FlyingSwordMode.Recall
                    ? "收剑护卫"
                    : "分散御剑";
        const lightningIntent = lightningChainCount > 0
            ? `雷意·惊蛰 ${Math.round(
                lightningDamageMultiplier * 100,
            )}%`
            : "";
        const metalIntent = metalMaximumMomentum > 0
            ? `金意·破势 ${Math.round(
                metalDamagePerMomentum * 100,
            )}%×${metalMaximumMomentum}`
            : "";
        const fireIntent = fireBurstThreshold > 0
            ? `火意·焚心 ${fireBurstThreshold}印/${Math.round(
                fireBurstDamageMultiplier * 100,
            )}%`
            : "";
        const coldIntent = coldMaximumStacks > 0
            ? `寒意·凝霜 ${Math.round(
                coldSlowPerStack * 100,
            )}%×${coldMaximumStacks}`
            : "";
        let activeIntents = lightningIntent;
        if (metalIntent) {
            activeIntents = activeIntents
                ? `${activeIntents} · ${metalIntent}`
                : metalIntent;
        }
        if (fireIntent) {
            activeIntents = activeIntents
                ? `${activeIntents} · ${fireIntent}`
                : fireIntent;
        }
        if (coldIntent) {
            activeIntents = activeIntents
                ? `${activeIntents} · ${coldIntent}`
                : coldIntent;
        }
        if (!activeIntents) activeIntents = "剑意未悟";
        this.view.intent.textContent = activeIntents;
        this.view.defeatOverlay.hidden =
            runPhase !== RogueRunPhase.Defeat;
        this.updateUpgradePanel(
            upgradeActive,
            upgradeA,
            upgradeB,
            upgradeC,
            offeredBlueprint,
            offeredQuality,
            offeredRecommendation,
            offeredMinimumDamage,
            offeredMaximumDamage,
            offeredAttackInterval,
            offeredMaximumSpeed,
            offeredAcceleration,
            offeredMaximumSpirit,
            offeredSpiritRecovery,
            offeredScatterSpiritCost,
            offeredFocusSpiritCost,
            offeredFormationSpiritDrain,
        );

        const mode = skillPhaseName(
            skillPhase,
            scene.mode,
            scene.stance,
            fusionActive,
            this.formationName,
        );
        const nearest = Number.isFinite(this.nearestDepth)
            ? this.nearestDepth.toFixed(2)
            : "--";
        const farthest = Number.isFinite(this.farthestDepth)
            ? this.farthestDepth.toFixed(2)
            : "--";
        const minimumHeight = Number.isFinite(this.minimumHeight)
            ? this.minimumHeight.toFixed(2)
            : "--";
        const maximumHeight = Number.isFinite(this.maximumHeight)
            ? this.maximumHeight.toFixed(2)
            : "--";
        this.view.status.textContent = [
            `持有飞剑  ${this.totalSwordCount} / ${swordCapacity}`,
            `神识御剑  ${this.formationSize} / ${controlLimit}`,
            `当前可见  ${this.visibleSwordCount}`,
            `可见妖物  ${this.visibleEnemyCount}`,
            `场上妖物  ${activeEnemies}`,
            `累计斩妖  ${kills}`,
            `当前状态  ${mode}`,
            `当前阵图  ${this.formationName}`,
            `当前剑意  ${activeIntents}`,
            `剑诀阶段  ${skillPhase}`,
            `生命      ${Math.ceil(health)} / ${Math.ceil(maximumHealth)}`,
            `法力      ${Math.ceil(mana)} / ${Math.ceil(maximumMana)}`,
            `修为      ${experience.toFixed(0)} / ${requiredExperience.toFixed(0)}`,
            "",
            `角色 X    ${this.followedX.toFixed(2)}`,
            `角色 Y    ${this.followedY.toFixed(2)}`,
            `角色 Z    ${this.followedZ.toFixed(2)}`,
            "",
            `集火 X    ${scene.targetX.toFixed(2)}`,
            `集火 Y    ${scene.targetY.toFixed(2)}`,
            `集火 Z    ${scene.targetZ.toFixed(2)}`,
            "",
            `最近深度  ${nearest}`,
            `最远深度  ${farthest}`,
            `高度范围  ${minimumHeight} ～ ${maximumHeight}`,
            "",
            "排序规则",
            "layer → depth↓ → stableId",
        ].join("\n");
    }

    private updateUpgradePanel(
        active: boolean,
        first: number,
        second: number,
        third: number,
        offeredBlueprint: number,
        offeredQuality: number,
        offeredRecommendation: number,
        offeredMinimumDamage: number,
        offeredMaximumDamage: number,
        offeredAttackInterval: number,
        offeredMaximumSpeed: number,
        offeredAcceleration: number,
        offeredMaximumSpirit: number,
        offeredSpiritRecovery: number,
        offeredScatterSpiritCost: number,
        offeredFocusSpiritCost: number,
        offeredFormationSpiritDrain: number,
    ): void {
        this.view.upgradePanel.hidden = !active;
        if (!active) return;
        const buttons = this.view.upgradeButtons;
        for (let index = 0; index < buttons.length; index++) {
            const name = this.upgradeNames[index];
            const description = this.upgradeDescriptions[index];
            const id = index === 0 ? first : index === 1 ? second : third;
            if (name) name.textContent = this.upgrades.names[id] ?? "未知剑途";
            if (description) {
                const base =
                    this.upgrades.descriptions[id] ?? "此道尚未明悟";
                description.textContent = id === RogueUpgrade.AddSword
                    ? `${base}\n${
                        this.swordBlueprints.names[offeredBlueprint] ??
                            "未知剑器"
                    } · 剑品 ${offeredQuality} · 推荐 ${
                        this.swordBlueprints.recommendationNames[
                            offeredRecommendation
                        ] ?? "未定"
                    }\n攻击 ` +
                        `${offeredMinimumDamage.toFixed(0)}–` +
                        `${offeredMaximumDamage.toFixed(0)} · 间隔 ` +
                        `${offeredAttackInterval} 帧 · 飞速 ` +
                        `${offeredMaximumSpeed.toFixed(1)} · 加速 ` +
                        `${offeredAcceleration.toFixed(1)}\n灵力 ` +
                        `${offeredMaximumSpirit.toFixed(0)} · 回灵 ` +
                        `${offeredSpiritRecovery.toFixed(1)}/秒 · 消耗 ` +
                        `分散 ${offeredScatterSpiritCost.toFixed(1)} / ` +
                        `集火 ${offeredFocusSpiritCost.toFixed(1)} / ` +
                        `剑阵 ${offeredFormationSpiritDrain.toFixed(1)}/秒`
                    : base;
            }
        }
    }

    private updateSwordReplacementPanel(
        selections: ReplacementSelections,
        inventory: SwordInventory,
    ): void {
        let offer = INVALID_ENTITY;
        let container = INVALID_ENTITY;
        const selectionIter = selections.iter();
        while (selectionIter.next()) {
            const [count, , data] = selectionIter.current;
            if (count === 0) continue;
            offer = data[SwordReplacementSelection.Offer][0];
            container = data[SwordReplacementSelection.Container][0];
            break;
        }
        const panel = this.view.swordReplacementPanel;
        panel.hidden = offer === INVALID_ENTITY;
        if (offer === INVALID_ENTITY) {
            this.replacementOffer = INVALID_ENTITY;
            delete panel.dataset.offer;
            return;
        }
        panel.dataset.offer = String(offer);
        if (this.replacementOffer === offer) return;
        this.replacementOffer = offer;

        const offeredBlueprint = this.world.get(
            offer,
            SwordUpgradeOfferType,
            SwordUpgradeOffer.Blueprint,
        ) ?? 0;
        const offeredQuality = this.world.get(
            offer,
            SwordUpgradeOfferType,
            SwordUpgradeOffer.Quality,
        ) ?? 1;
        const offeredMinimumDamage = this.world.get(
            offer,
            SwordUpgradeOfferType,
            SwordUpgradeOffer.MinimumDamage,
        ) ?? 0;
        const offeredMaximumDamage = this.world.get(
            offer,
            SwordUpgradeOfferType,
            SwordUpgradeOffer.MaximumDamage,
        ) ?? 0;
        const offeredInterval = this.world.get(
            offer,
            SwordUpgradeOfferType,
            SwordUpgradeOffer.AttackIntervalTicks,
        ) ?? 0;
        const offeredMaximumSpirit = this.world.get(
            offer,
            SwordUpgradeOfferType,
            SwordUpgradeOffer.MaximumSpiritPower,
        ) ?? 0;
        const offeredFocusCost = this.world.get(
            offer,
            SwordUpgradeOfferType,
            SwordUpgradeOffer.FocusSpiritCost,
        ) ?? 0;
        const proposed = `${
            this.swordBlueprints.names[offeredBlueprint] ?? "未知剑器"
        }·品${offeredQuality} 攻${offeredMinimumDamage.toFixed(0)}–${
            offeredMaximumDamage.toFixed(0)
        } 间隔${offeredInterval} 灵力${offeredMaximumSpirit.toFixed(0)} ` +
            `集火耗${offeredFocusCost.toFixed(1)}`;

        const candidates: SwordReplacementCandidate[] = [];
        const inventoryIter = inventory.iter();
        while (inventoryIter.next()) {
            const [
                count,
                entities,
                ,
                contained,
                identities,
                attacks,
                spirits,
                costs,
            ] = inventoryIter.current;
            const containers = contained[ContainedSword.Container];
            const inventorySlots =
                contained[ContainedSword.InventorySlot];
            const blueprints = identities[SwordIdentity.Blueprint];
            const qualities = identities[SwordIdentity.Quality];
            const minimumDamages = attacks[SwordAttack.MinimumDamage];
            const maximumDamages = attacks[SwordAttack.MaximumDamage];
            const intervals =
                attacks[SwordAttack.AttackIntervalTicks];
            const currentSpirits = spirits[SwordSpiritPower.Current];
            const maximumSpirits = spirits[SwordSpiritPower.Maximum];
            const focusCosts = costs[SwordSpiritCost.Focus];
            for (let row = 0; row < count; row++) {
                if (containers[row] !== container) continue;
                candidates.push({
                    entity: entities[row],
                    slot: inventorySlots[row],
                    blueprint: blueprints[row],
                    quality: qualities[row],
                    minimumDamage: minimumDamages[row],
                    maximumDamage: maximumDamages[row],
                    interval: intervals[row],
                    currentSpirit: currentSpirits[row],
                    maximumSpirit: maximumSpirits[row],
                    focusCost: focusCosts[row],
                    controlled: this.world.has(
                        entities[row],
                        ControlledFlyingSwordTag,
                    ),
                    pending: this.world.has(
                        entities[row],
                        PendingFlyingSwordRetireTag,
                    ),
                });
            }
        }
        candidates.sort((left, right) => left.slot - right.slot);
        const fragment = document.createDocumentFragment();
        for (let index = 0; index < candidates.length; index++) {
            const sword = candidates[index];
            const button = document.createElement("button");
            button.type = "button";
            button.dataset.outgoing = String(sword.entity);
            const name = document.createElement("strong");
            name.textContent = `${index + 1}. ${
                this.swordBlueprints.names[sword.blueprint] ?? "旧剑"
            } · 剑位 ${sword.slot}`;
            const description = document.createElement("small");
            const state = sword.pending
                ? "等待归阵"
                : sword.controlled
                    ? "神识受控"
                    : "背后待命";
            description.textContent =
                `${state} · 品${sword.quality} ` +
                `攻${sword.minimumDamage.toFixed(0)}–` +
                `${sword.maximumDamage.toFixed(0)} ` +
                `间隔${sword.interval} 灵力` +
                `${sword.currentSpirit.toFixed(0)}/` +
                `${sword.maximumSpirit.toFixed(0)} ` +
                `集火耗${sword.focusCost.toFixed(1)}\n→ ${proposed}`;
            button.append(name, description);
            fragment.append(button);
        }
        this.view.swordReplacementOptions.replaceChildren(fragment);
    }
}

interface SwordReplacementCandidate {
    readonly entity: Entity;
    readonly slot: number;
    readonly blueprint: number;
    readonly quality: number;
    readonly minimumDamage: number;
    readonly maximumDamage: number;
    readonly interval: number;
    readonly currentSpirit: number;
    readonly maximumSpirit: number;
    readonly focusCost: number;
    readonly controlled: boolean;
    readonly pending: boolean;
}

function skillPhaseName(
    phase: FlyingSwordSkillPhaseValue,
    mode: number,
    stance: number,
    fusionActive: boolean,
    formationName: string,
): string {
    if (fusionActive) return "身剑合一 · 螺旋突进";
    if (phase === FlyingSwordSkillPhase.Gather) return "穿云 · 聚剑";
    if (phase === FlyingSwordSkillPhase.Launch) return "穿云 · 弧冲";
    if (phase === FlyingSwordSkillPhase.Strike) return "穿云 · 贯穿";
    if (phase === FlyingSwordSkillPhase.Return) return "穿云 · 归剑";
    if (phase === FlyingSwordSkillPhase.Rejoin) return "穿云 · 入阵";
    if (mode === FlyingSwordMode.Recall) return "收剑护卫";
    return stance === FlyingSwordStance.Formation
        ? formationName
        : "分散御剑";
}

const SWORD_COLORS = [
    "#69f7d0",
    "#8ee8ff",
    "#ffd074",
    "#bca5ff",
    "#ff8e9f",
    "#a8ff8d",
    "#f2fbff",
] as const;

interface SwordSprite {
    readonly texture: Texture;
}

interface ActorSprite {
    readonly width: number;
    readonly height: number;
    readonly texture: Texture;
}

const ACTOR_SPRITES = [
    { width: 44, height: 96 },
    { width: 91, height: 80 },
    { width: 66, height: 88 },
    { width: 105, height: 112 },
    { width: 89, height: 104 },
] as const;

function drawEnemyTargetIndicator(
    context: PixiPainter,
    item: Readonly<DemoRenderItem>,
): void {
    const radiusX = Math.min(42, item.width * 0.42);
    const radiusY = Math.max(11, radiusX * 0.34);
    const y = item.y1 - 1;
    context.globalAlpha = Math.min(0.9, 0.5 + item.targeted * 0.08);
    context.strokeStyle = "#ffd074";
    context.lineWidth = 2;
    context.beginPath();
    context.ellipse(item.x1, y, radiusX, radiusY, 0, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.moveTo(item.x1 - 7, item.y1 - item.height - 3);
    context.lineTo(item.x1, item.y1 - item.height + 4);
    context.lineTo(item.x1 + 7, item.y1 - item.height - 3);
    context.stroke();
    context.globalAlpha = 1;
}

function drawEnemyColdAura(
    context: PixiPainter,
    item: Readonly<DemoRenderItem>,
): void {
    const radiusX = Math.min(44, item.width * 0.44);
    const radiusY = Math.max(10, radiusX * 0.3);
    const strength = Math.min(1, item.amount / 5);
    context.strokeStyle = "#8de9ff";
    context.globalAlpha = 0.35 + strength * 0.35;
    context.lineWidth = 2 + strength;
    context.beginPath();
    context.ellipse(
        item.x1,
        item.y1,
        radiusX,
        radiusY,
        0,
        0,
        Math.PI * 2,
    );
    context.stroke();
    const innerX = radiusX * 0.51;
    const innerY = radiusY * 0.51;
    const outerX = radiusX * 0.76;
    const outerY = radiusY * 0.76;
    context.beginPath();
    context.moveTo(item.x1 + innerX, item.y1 + innerY);
    context.lineTo(item.x1 + outerX, item.y1 + outerY);
    context.moveTo(item.x1 - innerX, item.y1 + innerY);
    context.lineTo(item.x1 - outerX, item.y1 + outerY);
    context.moveTo(item.x1 + innerX, item.y1 - innerY);
    context.lineTo(item.x1 + outerX, item.y1 - outerY);
    context.moveTo(item.x1 - innerX, item.y1 - innerY);
    context.lineTo(item.x1 - outerX, item.y1 - outerY);
    context.stroke();
    context.globalAlpha = 1;
}

function drawEnemyEmpowermentAura(
    context: PixiPainter,
    item: Readonly<DemoRenderItem>,
): void {
    const radiusX = Math.min(48, item.width * 0.48);
    const radiusY = Math.max(12, radiusX * 0.32);
    context.strokeStyle = "#c789ff";
    context.globalAlpha = 0.72;
    context.lineWidth = 2;
    context.beginPath();
    context.ellipse(
        item.x1,
        item.y1,
        radiusX,
        radiusY,
        0,
        0,
        Math.PI * 2,
    );
    context.stroke();
    context.globalAlpha = 0.34;
    context.beginPath();
    context.ellipse(
        item.x1,
        item.y1,
        radiusX * 0.7,
        radiusY * 0.7,
        0,
        0,
        Math.PI * 2,
    );
    context.stroke();
    context.globalAlpha = 1;
}

function drawSwordTrail(
    context: PixiPainter,
    item: Readonly<DemoRenderItem>,
): void {
    const centerX = (item.x1 + item.x2) * 0.5;
    const centerY = (item.y1 + item.y2) * 0.5;
    context.strokeStyle = item.color;
    context.globalAlpha = 0.12 * item.trailStrength;
    context.lineWidth = 9;
    context.beginPath();
    context.moveTo(item.trailX, item.trailY);
    context.lineTo(centerX, centerY);
    context.stroke();
    context.globalAlpha = 0.58 * item.trailStrength;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(item.trailX, item.trailY);
    context.lineTo(centerX, centerY);
    context.stroke();
    context.globalAlpha = 1;
}

function drawFusionAura(
    context: PixiPainter,
    item: Readonly<DemoRenderItem>,
): void {
    const centerY = item.y1 - 36;
    const previousY = item.y2 - 36;
    const deltaX = item.x1 - item.x2;
    const deltaY = centerY - previousY;
    const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const inverseLength = length > 1e-5 ? 1 / length : 0;
    const normalX = -deltaY * inverseLength;
    const normalY = deltaX * inverseLength;
    context.strokeStyle = "#8ee8ff";
    context.globalAlpha = 0.16;
    context.lineWidth = 22;
    context.beginPath();
    context.moveTo(item.x2, previousY);
    context.lineTo(item.x1, centerY);
    context.stroke();
    context.globalAlpha = 0.72;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(item.x2 + normalX * 8, previousY + normalY * 8);
    context.lineTo(item.x1 + normalX * 3, centerY + normalY * 3);
    context.moveTo(item.x2 - normalX * 8, previousY - normalY * 8);
    context.lineTo(item.x1 - normalX * 3, centerY - normalY * 3);
    context.stroke();
    context.globalAlpha =
        0.28 + Math.sin(item.amount * 0.6) * 0.08;
    context.lineWidth = 3;
    context.beginPath();
    context.arc(item.x1, centerY, 18, 0, Math.PI * 2);
    context.stroke();
    context.globalAlpha = 1;
}

function drawLightningArc(
    context: PixiPainter,
    item: Readonly<DemoRenderItem>,
): void {
    const dx = item.x2 - item.x1;
    const dy = item.y2 - item.y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length < 1e-4) return;
    const normalX = -dy / length;
    const normalY = dx / length;
    context.strokeStyle = "#42bfff";
    context.globalAlpha = item.alpha * 0.24;
    context.lineWidth = 10;
    traceLightningArc(context, item, normalX, normalY, 11);
    context.strokeStyle = "#d9fbff";
    context.globalAlpha = item.alpha;
    context.lineWidth = 2;
    traceLightningArc(context, item, normalX, normalY, 7);
    context.globalAlpha = 1;
}

function drawFireBurst(
    context: PixiPainter,
    item: Readonly<DemoRenderItem>,
): void {
    const halfWidth = item.width * 0.5;
    const halfHeight = item.height * 0.5;
    context.fillStyle = "#ff5a24";
    context.globalAlpha = item.alpha * 0.18;
    context.beginPath();
    context.ellipse(
        item.x1,
        item.y1,
        halfWidth,
        halfHeight,
        0,
        0,
        Math.PI * 2,
    );
    context.fill();
    context.strokeStyle = "#ff8a38";
    context.globalAlpha = item.alpha * 0.9;
    context.lineWidth = 5;
    context.beginPath();
    context.ellipse(
        item.x1,
        item.y1,
        halfWidth,
        halfHeight,
        0,
        0,
        Math.PI * 2,
    );
    context.stroke();
    const innerScale = 0.28 + item.amount * 0.34;
    context.strokeStyle = "#ffe38a";
    context.globalAlpha = item.alpha;
    context.lineWidth = 2;
    context.beginPath();
    context.ellipse(
        item.x1,
        item.y1,
        halfWidth * innerScale,
        halfHeight * innerScale,
        0,
        0,
        Math.PI * 2,
    );
    context.stroke();
    context.globalAlpha = 1;
}

function traceLightningArc(
    context: PixiPainter,
    item: Readonly<DemoRenderItem>,
    normalX: number,
    normalY: number,
    amplitude: number,
): void {
    let random = (
        Math.imul(item.stableId, 0x9e3779b1) ^
        Math.imul(item.style, 0x85ebca6b)
    ) >>> 0;
    context.beginPath();
    context.moveTo(item.x1, item.y1);
    for (let segment = 1; segment < 7; segment++) {
        random ^= random << 13;
        random ^= random >>> 17;
        random ^= random << 5;
        random >>>= 0;
        const t = segment / 7;
        const taper = Math.sin(t * Math.PI);
        const offset =
            ((random & 1023) / 1023 - 0.5) *
            amplitude *
            taper;
        context.lineTo(
            item.x1 + (item.x2 - item.x1) * t + normalX * offset,
            item.y1 + (item.y2 - item.y1) * t + normalY * offset,
        );
    }
    context.lineTo(item.x2, item.y2);
    context.stroke();
}

function drawActorSprite(
    context: PixiPainter,
    item: Readonly<DemoRenderItem>,
    sprite: Readonly<ActorSprite>,
): void {
    context.drawTexture(
        sprite.texture,
        Math.round(item.x1 - item.width * 0.5),
        Math.round(item.y1 - item.height + ACTOR_FOOT_OFFSET),
        item.width,
        item.height,
    );
}

function drawDamageDisplay(
    context: PixiPainter,
    item: Readonly<DemoRenderItem>,
): void {
    context.globalAlpha = item.alpha;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = damageDisplayFont(item.style);
    context.lineWidth = 4;
    context.strokeStyle = "rgba(7, 10, 12, 0.92)";
    context.fillStyle = damageDisplayColor(item.style);
    const text = String(Math.max(1, Math.round(item.amount)));
    context.strokeText(text, Math.round(item.x1), Math.round(item.y1));
    context.fillText(text, Math.round(item.x1), Math.round(item.y1));
    context.globalAlpha = 1;
}

function damageDisplayColor(style: number): string {
    return DAMAGE_DISPLAY_COLORS[style] ?? DAMAGE_DISPLAY_COLORS[
        DamageDisplayStyle.Dealt
    ];
}

function damageDisplayFont(style: number): string {
    return DAMAGE_DISPLAY_FONTS[style] ?? DAMAGE_DISPLAY_FONTS[
        DamageDisplayStyle.Dealt
    ];
}

function hitFlashTint(kind: number): string {
    return HIT_FLASH_TINTS[kind] ?? HIT_FLASH_TINTS[
        DamageKind.Generic
    ];
}

function drawEnemyHealth(
    context: PixiPainter,
    item: Readonly<DemoRenderItem>,
): void {
    const width = Math.min(54, Math.max(28, item.width * 0.55));
    const x = item.x1 - width * 0.5;
    const y = item.y1 - item.height + ACTOR_FOOT_OFFSET - 7;
    context.fillStyle = "rgba(0, 0, 0, 0.72)";
    context.fillRect(x - 1, y - 1, width + 2, 5);
    context.fillStyle = "#c94c55";
    context.fillRect(x, y, width * Math.max(0, item.health), 3);
}

function drawExperience(
    context: PixiPainter,
    item: Readonly<DemoRenderItem>,
): void {
    const radius = item.width * 0.5;
    context.fillStyle = "rgba(62, 238, 202, 0.18)";
    context.beginPath();
    context.arc(item.x1, item.y1, radius + 3, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#65e5c4";
    context.beginPath();
    context.moveTo(item.x1, item.y1 - radius);
    context.lineTo(item.x1 + radius * 0.7, item.y1);
    context.lineTo(item.x1, item.y1 + radius);
    context.lineTo(item.x1 - radius * 0.7, item.y1);
    context.closePath();
    context.fill();
}

function formatRunTime(tick: number): string {
    const totalSeconds = Math.floor(tick / 60);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds - minutes * 60;
    return `${String(minutes).padStart(2, "0")}:${
        String(seconds).padStart(2, "0")
    }`;
}

function drawGroundMarker(
    context: PixiPainter,
    point: Readonly<ProjectedPoint>,
    color: string,
    radiusX: number,
    radiusY: number,
    cross: boolean,
): void {
    context.strokeStyle = color;
    context.lineWidth = 2;
    context.beginPath();
    context.ellipse(
        point.x,
        point.y,
        radiusX,
        radiusY,
        0,
        0,
        Math.PI * 2,
    );
    if (cross) {
        context.moveTo(point.x - radiusX * 0.55, point.y);
        context.lineTo(point.x + radiusX * 0.55, point.y);
        context.moveTo(point.x, point.y - radiusY * 0.7);
        context.lineTo(point.x, point.y + radiusY * 0.7);
    }
    context.stroke();
}

function lerp(previous: number, current: number, alpha: number): number {
    return previous + (current - previous) * alpha;
}

function drawSwordSprite(
    context: PixiPainter,
    item: Readonly<DemoRenderItem>,
    sprite: Readonly<SwordSprite>,
    shadow = false,
): void {
    const dx = item.x2 - item.x1;
    const dy = item.y2 - item.y1;
    const projectedLength = Math.sqrt(dx * dx + dy * dy);
    if (projectedLength < 1e-5) return;
    // 只让本地剑身轴承受投影缩短；像素厚度不随转向一起缩放。
    const width = Math.max(38, Math.min(96, projectedLength * 1.35));
    const height =
        NOMINAL_SWORD_SPRITE_WIDTH *
        sprite.texture.height /
        sprite.texture.width;
    const centerX = (item.x1 + item.x2) * 0.5;
    const centerY = (item.y1 + item.y2) * 0.5;
    const inverseLength = 1 / projectedLength;
    const cosine = dx * inverseLength;
    const sine = dy * inverseLength;

    context.setTransform(cosine, sine, -sine, cosine, centerX, centerY);
    if (shadow) {
        context.globalAlpha = 0.3;
        context.drawTexture(
            sprite.texture,
            -width * 0.5,
            -height * 0.5,
            width,
            height,
            0x000000,
        );
    } else {
        context.globalAlpha = 0.32;
        context.drawTexture(
            sprite.texture,
            -width * 0.56,
            -height * 0.62,
            width * 1.12,
            height * 1.24,
            SWORD_COLORS[item.colorIndex] ?? SWORD_COLORS[0],
        );
        context.globalAlpha = 1;
        context.drawTexture(
            sprite.texture,
            -width * 0.5,
            -height * 0.5,
            width,
            height,
        );
    }
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha = 1;
}

function drawSwordFallback(
    context: PixiPainter,
    item: Readonly<DemoRenderItem>,
    shadow = false,
): void {
    context.strokeStyle = shadow ? "rgba(0, 0, 0, 0.3)" : item.color;
    context.lineWidth = shadow ? 6 : 4;
    context.beginPath();
    context.moveTo(item.x1, item.y1);
    context.lineTo(item.x2, item.y2);
    context.stroke();
    if (!shadow) {
        context.strokeStyle = "#effffa";
        context.lineWidth = 1.25;
        context.stroke();
    }
}

const NOMINAL_SWORD_SPRITE_WIDTH = 84;
const CULTIVATOR_WIDTH = 44;
const CULTIVATOR_HEIGHT = 96;
const ACTOR_FOOT_OFFSET = 7;
const VIEW_CULLING_MARGIN = 192;
const GRID_HALF_SPAN = 24;
const FORMATION_PATH_SAMPLES = 48;
const FORMATION_GROUND_HEIGHT = 0.035;
const FORMATION_DIRECTION_EPSILON = 1e-6;
const FORMATION_DEBUG_MAXIMUM_SLOTS = 64;
const FORMATION_DEBUG_TANGENT_LENGTH = 0.42;
const CAMERA_TARGET_HEIGHT = 0.9;
const CAMERA_TARGET_FORWARD_OFFSET = 2.2;
const STATUS_UPDATE_INTERVAL_FRAMES = 6;
const MAX_SWORD_TRAILS = 160;
const MAX_LIGHTNING_ARCS = 96;
const LIGHTNING_ARC_CULL_PADDING = 32;
const MAX_FIRE_BURSTS = 48;
const FIRE_BURST_PIXELS_PER_WORLD_UNIT = 62;
const MAX_COLD_AURAS = 96;
const MAX_ENEMY_EMPOWERMENT_AURAS = 96;
const MAX_STONE_GOLEM_CHARGE_WARNINGS = 16;
const MAX_SWORD_WRAITH_PULSES = 16;
const SWORD_WRAITH_PULSE_SAMPLES = 24;
const STONE_GOLEM_WARNING_DASH = Object.freeze([10, 7]);
const SOLID_LINE_DASH = Object.freeze([] as number[]);
const SWORD_TRAIL_MINIMUM_DISTANCE_SQUARED = 0.012;
const DAMAGE_DISPLAY_COLORS: Readonly<Record<number, string>> =
    Object.freeze({
        [DamageDisplayStyle.Dealt]: "#ffe08a",
        [DamageDisplayStyle.Taken]: "#ff6f72",
        [DamageDisplayStyle.ScatterSword]: "#8fe9ff",
        [DamageDisplayStyle.FocusSword]: "#fff09b",
        [DamageDisplayStyle.FormationSword]: "#c7a2ff",
        [DamageDisplayStyle.SwordBodyUnity]: "#ff9b68",
        [DamageDisplayStyle.LightningChain]: "#8de8ff",
        [DamageDisplayStyle.MetalBreak]: "#ffd56a",
        [DamageDisplayStyle.FireBurst]: "#ff8a42",
    });
const DAMAGE_DISPLAY_FONTS: Readonly<Record<number, string>> =
    Object.freeze({
        [DamageDisplayStyle.Dealt]: "700 20px monospace",
        [DamageDisplayStyle.Taken]: "700 20px monospace",
        [DamageDisplayStyle.ScatterSword]: "700 19px monospace",
        [DamageDisplayStyle.FocusSword]: "800 22px monospace",
        [DamageDisplayStyle.FormationSword]: "700 18px monospace",
        [DamageDisplayStyle.SwordBodyUnity]: "800 24px monospace",
        [DamageDisplayStyle.LightningChain]: "800 21px monospace",
        [DamageDisplayStyle.MetalBreak]: "900 22px monospace",
        [DamageDisplayStyle.FireBurst]: "900 23px monospace",
    });
const HIT_FLASH_TINTS: Readonly<Record<number, string>> =
    Object.freeze({
        [DamageKind.Generic]: "#ffffff",
        [DamageKind.ScatterSword]: "#70dfff",
        [DamageKind.FocusSword]: "#ffd978",
        [DamageKind.FormationSword]: "#d6a3ff",
        [DamageKind.SwordBodyUnity]: "#ff9c64",
        [DamageKind.LightningChain]: "#8fe9ff",
        [DamageKind.MetalBreak]: "#ffe07a",
        [DamageKind.FireBurst]: "#ff6f4a",
    });
