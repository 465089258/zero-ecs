import {
    Inject,
    Service,
    type QueryOf,
} from "@zero-ecs/game";
import {
    FlyingSwordField,
    FlyingSwordMode,
    FlyingSwordQuery,
    FlyingSwordSkillPhase,
    FlyingSwordSkillService,
    type FlyingSwordSkillPhaseValue,
    type Vector3Out,
} from "@zero-ecs/flying-sword";
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
import {
    CultivatorQuery,
    Transform3Field,
} from "../simulation/components";
import { DemoSceneState } from "../simulation/state";

type Swords = QueryOf<typeof FlyingSwordQuery>;
type Cultivators = QueryOf<typeof CultivatorQuery>;

const enum RenderKind {
    Shadow,
    Cultivator,
    Sword,
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
}

/** 示例专属 Canvas 表现后端。 */
export class DemoRenderService extends Service {
    @Inject.resource(DemoViewResource) private readonly view!: DemoViewResource;
    @Inject.service(FlyingSwordSkillService)
    private readonly skills!: FlyingSwordSkillService;

    private readonly logicalWidth = 960;
    private readonly logicalHeight = 640;
    private readonly camera = new TopDownOrthographicCamera({
        viewportWidth: this.logicalWidth,
        viewportHeight: this.logicalHeight,
        elevation: degreesToRadians(50),
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
    private readonly groundLayer = document.createElement("canvas");
    private readonly projected: ProjectedPoint = { x: 0, y: 0, depth: 0 };
    private readonly projectedSecond: ProjectedPoint = { x: 0, y: 0, depth: 0 };
    private readonly clientPoint = { x: 0, y: 0 };
    private totalSwordCount = 0;
    private visibleSwordCount = 0;
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
        cultivators: Cultivators,
        swords: Swords,
    ): void {
        const skillPhase = this.skills.phase(scene.swordGroup);
        this.followCultivator(
            cultivators,
            scene.cultivator,
            interpolation,
        );
        this.beginFrame();
        this.drawGroundGrid();
        this.drawGroundTargets(scene, skillPhase);
        this.queue.begin();
        this.collectCultivators(cultivators, interpolation);
        this.collectSwords(swords, interpolation);
        this.queue.sort();
        this.drawSortedItems();
        if (this.statusCountdown === 0) {
            this.drawStatus(scene, skillPhase);
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

    private drawGroundTargets(
        scene: Readonly<DemoSceneState>,
        skillPhase: FlyingSwordSkillPhaseValue,
    ): void {
        const context = this.view.context;
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
        this.camera.project(scene.targetX, 0, scene.targetZ, this.projected);
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

    private followCultivator(
        cultivators: Cultivators,
        entity: number,
        interpolation: number,
    ): void {
        const iter = cultivators.iter();
        while (iter.next()) {
            const [count, entities, transforms] = iter.current;
            const previousXs = transforms[Transform3Field.PreviousX];
            const previousYs = transforms[Transform3Field.PreviousY];
            const previousZs = transforms[Transform3Field.PreviousZ];
            const xs = transforms[Transform3Field.X];
            const ys = transforms[Transform3Field.Y];
            const zs = transforms[Transform3Field.Z];
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
    ): void {
        const iter = cultivators.iter();
        while (iter.next()) {
            const [count, entities, transforms] = iter.current;
            const previousXs = transforms[Transform3Field.PreviousX];
            const previousYs = transforms[Transform3Field.PreviousY];
            const previousZs = transforms[Transform3Field.PreviousZ];
            const xs = transforms[Transform3Field.X];
            const ys = transforms[Transform3Field.Y];
            const zs = transforms[Transform3Field.Z];
            for (let row = 0; row < count; row++) {
                const x = lerp(previousXs[row], xs[row], interpolation);
                const y = lerp(previousYs[row], ys[row], interpolation);
                const z = lerp(previousZs[row], zs[row], interpolation);
                this.camera.project(x, y, z, this.projected);
                this.camera.project(x, y + 1.75, z, this.projectedSecond);
                const item = this.queue.acquire();
                item.kind = RenderKind.Cultivator;
                item.sprite = 0;
                item.layer = DemoRenderLayer.World;
                item.depth = this.projected.depth;
                item.subOrder = 0;
                item.stableId = entities[row] * 4 + 2;
                item.x1 = this.projected.x;
                item.y1 = this.projected.y;
                item.x2 = this.projectedSecond.x;
                item.y2 = this.projectedSecond.y;
                item.color = "#c9f5e7";
            }
        }
    }

    private collectSwords(swords: Swords, interpolation: number): void {
        const iter = swords.iter();
        while (iter.next()) {
            const [count, entities, data] = iter.current;
            const previousXs = data[FlyingSwordField.PreviousX];
            const previousYs = data[FlyingSwordField.PreviousY];
            const previousZs = data[FlyingSwordField.PreviousZ];
            const xs = data[FlyingSwordField.X];
            const ys = data[FlyingSwordField.Y];
            const zs = data[FlyingSwordField.Z];
            const forwardXs = data[FlyingSwordField.ForwardX];
            const forwardYs = data[FlyingSwordField.ForwardY];
            const forwardZs = data[FlyingSwordField.ForwardZ];
            const visualIds = data[FlyingSwordField.VisualId];
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
                if (
                    this.projected.x < -VIEW_CULLING_MARGIN ||
                    this.projected.x > this.logicalWidth + VIEW_CULLING_MARGIN ||
                    this.projected.y < -VIEW_CULLING_MARGIN ||
                    this.projected.y > this.logicalHeight + VIEW_CULLING_MARGIN
                ) {
                    continue;
                }

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
                shadow.kind = RenderKind.Shadow;
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
                this.visibleSwordCount++;
                this.nearestDepth = Math.min(this.nearestDepth, sword.depth);
                this.farthestDepth = Math.max(this.farthestDepth, sword.depth);
                this.minimumHeight = Math.min(this.minimumHeight, y);
                this.maximumHeight = Math.max(this.maximumHeight, y);
            }
        }
    }

    private drawSortedItems(): void {
        const context = this.view.context;
        const items = this.queue.items;
        const length = this.queue.length;
        for (let index = 0; index < length; index++) {
            const item = items[index];
            if (item.kind === RenderKind.Shadow) {
                const sprite = this.swordSprites[item.sprite];
                if (sprite.shadow) {
                    drawSwordSprite(context, item, sprite, true);
                } else {
                    drawSwordFallback(context, item, true);
                }
            } else if (item.kind === RenderKind.Cultivator) {
                context.strokeStyle = "rgba(15, 29, 29, 0.88)";
                context.lineWidth = 16;
                context.beginPath();
                context.moveTo(item.x1, item.y1);
                context.lineTo(item.x2, item.y2 + 7);
                context.stroke();
                context.strokeStyle = item.color;
                context.lineWidth = 9;
                context.beginPath();
                context.moveTo(item.x1, item.y1 - 2);
                context.lineTo(item.x2, item.y2 + 8);
                context.stroke();
                context.fillStyle = "#eafdf6";
                context.beginPath();
                context.arc(item.x2, item.y2, 6, 0, Math.PI * 2);
                context.fill();
            } else {
                const sprite = this.swordSprites[item.sprite];
                if (sprite.glowVariants[item.colorIndex]) {
                    drawSwordSprite(context, item, sprite);
                } else {
                    drawSwordFallback(context, item);
                }
            }
        }
    }

    private drawStatus(
        scene: Readonly<DemoSceneState>,
        skillPhase: FlyingSwordSkillPhaseValue,
    ): void {
        const mode = skillPhaseName(skillPhase, scene.mode);
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
            `当前状态  ${mode}`,
            `剑诀阶段  ${skillPhase}`,
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
}

function skillPhaseName(
    phase: FlyingSwordSkillPhaseValue,
    mode: number,
): string {
    if (phase === FlyingSwordSkillPhase.Gather) return "穿云 · 聚剑";
    if (phase === FlyingSwordSkillPhase.Launch) return "穿云 · 齐射";
    if (phase === FlyingSwordSkillPhase.Strike) return "穿云 · 贯穿";
    if (phase === FlyingSwordSkillPhase.Return) return "穿云 · 归剑";
    if (phase === FlyingSwordSkillPhase.Rejoin) return "穿云 · 入阵";
    return mode === FlyingSwordMode.Recall ? "召回" : "护体环绕";
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

const SWORD_SPRITES = [
    { url: swordJadeUrl },
    { url: swordFlameUrl },
    { url: swordFrostUrl },
    { url: swordThunderUrl },
] as const;

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
const VIEW_CULLING_MARGIN = 192;
const GRID_HALF_SPAN = 24;
const CAMERA_TARGET_HEIGHT = 0.9;
const CAMERA_TARGET_FORWARD_OFFSET = 2.2;
const SPRITE_GLOW_PADDING = 12;
const SPRITE_GLOW_BLUR = 9;
const STATUS_UPDATE_INTERVAL_FRAMES = 6;
