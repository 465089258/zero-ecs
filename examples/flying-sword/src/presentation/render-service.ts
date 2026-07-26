import {
    Inject,
    Service,
    type QueryOf,
} from "@zero-ecs/game";
import {
    FlyingSwordFormation,
    FlyingSwordFormationCatalog,
    FlyingSwordFormationPlan,
    FlyingSwordFormationPlanId,
    FlyingSwordGroupQuery,
    FlyingSwordMode,
    FlyingSwordStance,
    FlyingSwordSkillPhase,
    FlyingSwordSkillService,
    type FlyingSwordFormationRouteSample,
    type FlyingSwordFormationSlotSample,
    type FlyingSwordSkillPhaseValue,
} from "@zero-ecs/flying-sword";
import { Float3 } from "@zero-ecs/math/3d";
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
import swordFlameUrl from "../assets/swords/sword-flame-render.png";
import swordFrostUrl from "../assets/swords/sword-frost-render.png";
import swordJadeUrl from "../assets/swords/sword-jade-render.png";
import swordThunderUrl from "../assets/swords/sword-thunder-render.png";
import cultivatorUrl from "../assets/characters/cultivator-render.png";
import bonePuppetUrl from "../assets/monsters/bone-puppet-render.png";
import corruptedBatUrl from "../assets/monsters/corrupted-bat-render.png";
import stoneGolemUrl from "../assets/monsters/stone-golem-render.png";
import swordWraithUrl from "../assets/monsters/sword-wraith-render.png";
import {
    FlyingSwordVisual,
} from "../content/components";
import {
    DamageDisplay,
    DamageDisplayStyle,
} from "../damage-display/components";
import { DamageDisplayQuery } from "../damage-display/queries";
import { RogueUpgradeCatalog } from "../content/upgrades";
import { DemoSceneState } from "../simulation/state";
import {
    EnemyBody,
    EnemyFeedback,
    EnemyIdentity,
    ExperiencePickup,
    Health,
    LevelExperience,
    PlayerStamina,
    RogueRunClock,
    RogueRunPhase,
    RogueRunStatistics,
    RogueRunStatus,
    RogueRunTarget,
    SwordBodyUnity,
    UpgradeSelection,
} from "../simulation/rogue/components";
import {
    RogueEnemyRenderQuery,
    RogueExperiencePickupQuery,
    RoguePlayerQuery,
    RogueRunQuery,
} from "../simulation/rogue/queries";
import { DemoFlyingSwordRenderQuery } from "./queries";
import type { Vector3Out } from "./types";

type Swords = QueryOf<typeof DemoFlyingSwordRenderQuery>;
type Runs = QueryOf<typeof RogueRunQuery>;
type Cultivators = QueryOf<typeof RoguePlayerQuery>;
type Enemies = QueryOf<typeof RogueEnemyRenderQuery>;
type Pickups = QueryOf<typeof RogueExperiencePickupQuery>;
type DamageDisplays = QueryOf<typeof DamageDisplayQuery>;
type SwordGroups = QueryOf<typeof FlyingSwordGroupQuery>;

enum RenderKind {
    SwordShadow,
    ActorShadow,
    Cultivator,
    Enemy,
    Experience,
    Sword,
    FusionAura,
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
    trailX: number;
    trailY: number;
    trailStrength: number;
}

/** 示例专属 Canvas 表现后端。 */
export class DemoRenderService extends Service {
    @Inject.resource(DemoViewResource) private readonly view!: DemoViewResource;
    @Inject.service(FlyingSwordSkillService)
    private readonly skills!: FlyingSwordSkillService;
    @Inject.resource(RogueUpgradeCatalog)
    private readonly upgrades!: RogueUpgradeCatalog;
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
        trailX: 0,
        trailY: 0,
        trailStrength: 0,
    }));
    private readonly swordSprites: SwordSprite[] = SWORD_SPRITES.map(definition => ({
        ...definition,
        image: new Image(),
        bodyWidth: 0,
        bodyHeight: 0,
        glowPadding: 0,
        shadow: null,
        glowVariants: [],
    }));
    private readonly actorSprites: ActorSprite[] = ACTOR_SPRITES.map(
        definition => ({
            ...definition,
            image: new Image(),
        }),
    );
    private readonly groundLayer = document.createElement("canvas");
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
    private nearestDepth = 0;
    private farthestDepth = 0;
    private minimumHeight = 0;
    private maximumHeight = 0;
    private statusCountdown = 0;
    private followedX = 0;
    private followedY = 0;
    private followedZ = 0;

    init(): void {
        // 像素素材在 DPR=1 已保持硬边；更高 DPR 只会扩大填充面积。
        const ratio = 1;
        this.view.canvas.width = this.logicalWidth * ratio;
        this.view.canvas.height = this.logicalHeight * ratio;
        this.view.context.setTransform(ratio, 0, 0, ratio, 0, 0);
        this.view.context.lineCap = "round";
        this.view.context.lineJoin = "round";
        this.view.context.imageSmoothingEnabled = false;
        this.view.context.shadowBlur = 0;
        this.buildGroundLayer();
        for (let index = 0; index < this.swordSprites.length; index++) {
            const sprite = this.swordSprites[index];
            sprite.image.decoding = "async";
            sprite.image.addEventListener(
                "load",
                () => prepareSwordSprite(sprite),
                { once: true },
            );
            sprite.image.src = sprite.url;
        }
        for (let index = 0; index < this.actorSprites.length; index++) {
            const sprite = this.actorSprites[index];
            sprite.image.decoding = "async";
            sprite.image.src = sprite.url;
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
        pickups: Pickups,
        damages: DamageDisplays,
        groups: SwordGroups,
        swords: Swords,
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
        this.queue.sort();
        this.drawSortedItems();
        if (this.statusCountdown === 0) {
            this.drawStatus(scene, runs, cultivators, skillPhase);
            this.statusCountdown = STATUS_UPDATE_INTERVAL_FRAMES - 1;
        } else {
            this.statusCountdown--;
        }
    }

    private beginFrame(): void {
        const context = this.view.context;
        context.drawImage(this.groundLayer, 0, 0);
        context.globalAlpha = 1;
        this.totalSwordCount = 0;
        this.visibleSwordCount = 0;
        this.visibleEnemyCount = 0;
        this.swordTrailCount = 0;
        this.nearestDepth = Number.POSITIVE_INFINITY;
        this.farthestDepth = Number.NEGATIVE_INFINITY;
        this.minimumHeight = Number.POSITIVE_INFINITY;
        this.maximumHeight = Number.NEGATIVE_INFINITY;
    }

    private buildGroundLayer(): void {
        this.groundLayer.width = this.logicalWidth;
        this.groundLayer.height = this.logicalHeight;
        const context = this.groundLayer.getContext("2d", { alpha: false });
        if (!context) throw new Error("Cannot create flying sword ground layer");
        context.fillStyle = "#071012";
        context.fillRect(0, 0, this.logicalWidth, this.logicalHeight);
    }

    private drawGroundGrid(): void {
        const context = this.view.context;
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
        const context = this.view.context;
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
        context: CanvasRenderingContext2D,
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

    private drawFormationDebug(
        context: CanvasRenderingContext2D,
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

    private readRunTick(runs: Runs): number {
        const iter = runs.iter();
        while (iter.next()) {
            const [count, , , clocks] = iter.current;
            if (count > 0) return clocks[RogueRunClock.Tick][0];
        }
        return 0;
    }

    private drawSortedItems(): void {
        const context = this.view.context;
        const items = this.queue.items;
        const length = this.queue.length;
        for (let index = 0; index < length; index++) {
            const item = items[index];
            if (item.kind === RenderKind.SwordShadow) {
                const sprite = this.swordSprites[item.sprite];
                if (sprite.shadow) {
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
                drawActorSprite(
                    context,
                    item,
                    this.actorSprites[item.sprite],
                );
                if (item.flash !== 0) {
                    context.globalAlpha = 0.72;
                    context.filter = "brightness(3) grayscale(1)";
                    drawActorSprite(
                        context,
                        item,
                        this.actorSprites[item.sprite],
                    );
                    context.filter = "none";
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
                if (sprite.glowVariants[item.colorIndex]) {
                    drawSwordSprite(context, item, sprite);
                } else {
                    drawSwordFallback(context, item);
                }
            } else if (item.kind === RenderKind.FusionAura) {
                drawFusionAura(context, item);
            } else if (item.kind === RenderKind.Damage) {
                drawDamageDisplay(context, item);
            }
        }
    }

    private drawStatus(
        scene: Readonly<DemoSceneState>,
        runs: Runs,
        cultivators: Cultivators,
        skillPhase: FlyingSwordSkillPhaseValue,
    ): void {
        let tick = 0;
        let kills = 0;
        let activeEnemies = 0;
        let runPhase = RogueRunPhase.Playing;
        let upgradeActive = false;
        let upgradeA = 0;
        let upgradeB = 1;
        let upgradeC = 2;
        const runIter = runs.iter();
        while (runIter.next()) {
            const [
                count,
                ,
                ,
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
            upgradeActive =
                selection[UpgradeSelection.Active][0] !== 0;
            upgradeA = selection[UpgradeSelection.OptionA][0];
            upgradeB = selection[UpgradeSelection.OptionB][0];
            upgradeC = selection[UpgradeSelection.OptionC][0];
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
            break;
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
        this.view.defeatOverlay.hidden =
            runPhase !== RogueRunPhase.Defeat;
        this.updateUpgradePanel(
            upgradeActive,
            upgradeA,
            upgradeB,
            upgradeC,
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
            `飞剑数量  ${this.totalSwordCount}`,
            `当前可见  ${this.visibleSwordCount}`,
            `可见妖物  ${this.visibleEnemyCount}`,
            `场上妖物  ${activeEnemies}`,
            `累计斩妖  ${kills}`,
            `当前状态  ${mode}`,
            `当前阵图  ${this.formationName}`,
            `剑诀阶段  ${skillPhase}`,
            `生命      ${Math.ceil(health)} / ${Math.ceil(maximumHealth)}`,
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
                description.textContent =
                    this.upgrades.descriptions[id] ?? "此道尚未明悟";
            }
        }
    }
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
    readonly url: string;
    readonly image: HTMLImageElement;
    bodyWidth: number;
    bodyHeight: number;
    glowPadding: number;
    shadow: HTMLCanvasElement | null;
    glowVariants: HTMLCanvasElement[];
}

interface ActorSprite {
    readonly url: string;
    readonly width: number;
    readonly height: number;
    readonly image: HTMLImageElement;
}

const SWORD_SPRITES = [
    { url: swordJadeUrl },
    { url: swordFlameUrl },
    { url: swordFrostUrl },
    { url: swordThunderUrl },
] as const;

const ACTOR_SPRITES = [
    { url: cultivatorUrl, width: 44, height: 96 },
    { url: corruptedBatUrl, width: 91, height: 80 },
    { url: bonePuppetUrl, width: 66, height: 88 },
    { url: stoneGolemUrl, width: 105, height: 112 },
    { url: swordWraithUrl, width: 89, height: 104 },
] as const;

function drawEnemyTargetIndicator(
    context: CanvasRenderingContext2D,
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

function drawSwordTrail(
    context: CanvasRenderingContext2D,
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
    context: CanvasRenderingContext2D,
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

function drawActorSprite(
    context: CanvasRenderingContext2D,
    item: Readonly<DemoRenderItem>,
    sprite: Readonly<ActorSprite>,
): void {
    if (sprite.image.complete && sprite.image.naturalWidth > 0) {
        context.drawImage(
            sprite.image,
            Math.round(item.x1 - item.width * 0.5),
            Math.round(item.y1 - item.height + ACTOR_FOOT_OFFSET),
            item.width,
            item.height,
        );
        return;
    }
    context.fillStyle = item.kind === RenderKind.Cultivator
        ? "#d9fff3"
        : "#8d4c57";
    context.beginPath();
    context.arc(item.x1, item.y1 - 18, 12, 0, Math.PI * 2);
    context.fill();
}

function drawDamageDisplay(
    context: CanvasRenderingContext2D,
    item: Readonly<DemoRenderItem>,
): void {
    context.globalAlpha = item.alpha;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = "700 20px monospace";
    context.lineWidth = 4;
    context.strokeStyle = "rgba(7, 10, 12, 0.92)";
    context.fillStyle =
        item.style === DamageDisplayStyle.Taken
            ? "#ff6f72"
            : "#ffe08a";
    const text = String(Math.max(1, Math.round(item.amount)));
    context.strokeText(text, Math.round(item.x1), Math.round(item.y1));
    context.fillText(text, Math.round(item.x1), Math.round(item.y1));
    context.globalAlpha = 1;
}

function drawEnemyHealth(
    context: CanvasRenderingContext2D,
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
    context: CanvasRenderingContext2D,
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
    context: CanvasRenderingContext2D,
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
    context: CanvasRenderingContext2D,
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
        NOMINAL_SWORD_SPRITE_WIDTH * sprite.bodyHeight / sprite.bodyWidth;
    const centerX = (item.x1 + item.x2) * 0.5;
    const centerY = (item.y1 + item.y2) * 0.5;
    const inverseLength = 1 / projectedLength;
    const cosine = dx * inverseLength;
    const sine = dy * inverseLength;

    context.setTransform(cosine, sine, -sine, cosine, centerX, centerY);
    if (shadow) {
        context.globalAlpha = 0.3;
        context.drawImage(
            sprite.shadow as HTMLCanvasElement,
            -width * 0.5,
            -height * 0.5,
            width,
            height,
        );
    } else {
        const variant = sprite.glowVariants[item.colorIndex];
        const horizontalPadding = sprite.glowPadding * width / sprite.bodyWidth;
        const verticalPadding = sprite.glowPadding * height / sprite.bodyHeight;
        context.drawImage(
            variant,
            -width * 0.5 - horizontalPadding,
            -height * 0.5 - verticalPadding,
            width + horizontalPadding * 2,
            height + verticalPadding * 2,
        );
    }
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha = 1;
}

function prepareSwordSprite(sprite: SwordSprite): void {
    const width = sprite.image.naturalWidth;
    const height = sprite.image.naturalHeight;
    if (width <= 0 || height <= 0) return;
    sprite.bodyWidth = width;
    sprite.bodyHeight = height;
    sprite.glowPadding = SPRITE_GLOW_PADDING;

    const shadow = createSpriteCanvas(width, height);
    const shadowContext = context2d(shadow);
    shadowContext.imageSmoothingEnabled = false;
    shadowContext.drawImage(sprite.image, 0, 0);
    shadowContext.globalCompositeOperation = "source-in";
    shadowContext.fillStyle = "#000000";
    shadowContext.fillRect(0, 0, width, height);
    shadowContext.globalCompositeOperation = "source-over";
    sprite.shadow = shadow;

    const variants = sprite.glowVariants;
    variants.length = SWORD_COLORS.length;
    for (let index = 0; index < SWORD_COLORS.length; index++) {
        const variant = createSpriteCanvas(
            width + SPRITE_GLOW_PADDING * 2,
            height + SPRITE_GLOW_PADDING * 2,
        );
        const variantContext = context2d(variant);
        variantContext.imageSmoothingEnabled = false;
        // shadowBlur 只在素材加载冷路径执行一次，稳定帧只绘制预烘焙位图。
        variantContext.shadowColor = SWORD_COLORS[index];
        variantContext.shadowBlur = SPRITE_GLOW_BLUR;
        variantContext.drawImage(
            sprite.image,
            SPRITE_GLOW_PADDING,
            SPRITE_GLOW_PADDING,
        );
        variants[index] = variant;
    }
}

function createSpriteCanvas(width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
}

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Cannot create flying sword sprite layer");
    return context;
}

function drawSwordFallback(
    context: CanvasRenderingContext2D,
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
const SPRITE_GLOW_PADDING = 12;
const SPRITE_GLOW_BLUR = 9;
const STATUS_UPDATE_INTERVAL_FRAMES = 6;
const MAX_SWORD_TRAILS = 160;
const SWORD_TRAIL_MINIMUM_DISTANCE_SQUARED = 0.012;
