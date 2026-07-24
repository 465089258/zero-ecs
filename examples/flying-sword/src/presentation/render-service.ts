import {
    Inject,
    Service,
    type QueryOf,
} from "@zero-ecs/game";
import {
    FlyingSwordField,
    FlyingSwordMode,
    FlyingSwordQuery,
    type Vector3Out,
} from "@zero-ecs/flying-sword";
import {
    DepthRenderQueue,
    FlyingSwordRenderLayer,
    TopDownOrthographicCamera,
    degreesToRadians,
    type DepthRenderItem,
    type ProjectedPoint,
} from "@zero-ecs/flying-sword/presentation";
import { DemoViewResource } from "../app/resources";
import swordFlameUrl from "../assets/swords/sword-flame.png";
import swordFrostUrl from "../assets/swords/sword-frost.png";
import swordJadeUrl from "../assets/swords/sword-jade.png";
import swordThunderUrl from "../assets/swords/sword-thunder.png";
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
    color: string;
}

/** 示例专属 Canvas 表现后端。 */
export class DemoRenderService extends Service {
    @Inject.resource(DemoViewResource) private readonly view!: DemoViewResource;

    private readonly logicalWidth = 960;
    private readonly logicalHeight = 640;
    private readonly camera = new TopDownOrthographicCamera({
        viewportWidth: this.logicalWidth,
        viewportHeight: this.logicalHeight,
        elevation: degreesToRadians(27.5),
        yaw: degreesToRadians(45),
        zoom: 62,
        target: { x: 0, y: 0.9, z: 2.2 },
    });
    private readonly queue = new DepthRenderQueue<DemoRenderItem>(() => ({
        kind: RenderKind.Sword,
        sprite: 0,
        layer: FlyingSwordRenderLayer.World,
        depth: 0,
        subOrder: 0,
        stableId: 0,
        x1: 0,
        y1: 0,
        x2: 0,
        y2: 0,
        color: "#ffffff",
    }));
    private readonly swordSprites = SWORD_SPRITES.map(definition => ({
        ...definition,
        image: new Image(),
    }));
    private readonly projected: ProjectedPoint = { x: 0, y: 0, depth: 0 };
    private readonly projectedSecond: ProjectedPoint = { x: 0, y: 0, depth: 0 };
    private readonly clientPoint = { x: 0, y: 0 };
    private swordCount = 0;
    private nearestDepth = 0;
    private farthestDepth = 0;
    private minimumHeight = 0;
    private maximumHeight = 0;

    init(): void {
        const ratio = Math.min(devicePixelRatio || 1, 2);
        this.view.canvas.width = this.logicalWidth * ratio;
        this.view.canvas.height = this.logicalHeight * ratio;
        this.view.context.setTransform(ratio, 0, 0, ratio, 0, 0);
        for (const sprite of this.swordSprites) sprite.image.src = sprite.url;
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
        this.beginFrame();
        this.drawGround(scene);
        this.queue.begin();
        this.collectCultivators(cultivators);
        this.collectSwords(swords, interpolation);
        this.queue.sort();
        this.drawSortedItems();
        this.drawStatus(scene);
    }

    private beginFrame(): void {
        const context = this.view.context;
        context.clearRect(0, 0, this.logicalWidth, this.logicalHeight);
        context.fillStyle = "#071012";
        context.fillRect(0, 0, this.logicalWidth, this.logicalHeight);
        context.lineCap = "round";
        context.lineJoin = "round";
        context.imageSmoothingEnabled = false;
        context.globalAlpha = 1;
        context.shadowBlur = 0;
        this.swordCount = 0;
        this.nearestDepth = Number.POSITIVE_INFINITY;
        this.farthestDepth = Number.NEGATIVE_INFINITY;
        this.minimumHeight = Number.POSITIVE_INFINITY;
        this.maximumHeight = Number.NEGATIVE_INFINITY;
    }

    private drawGround(scene: Readonly<DemoSceneState>): void {
        const context = this.view.context;
        context.lineWidth = 1;
        context.strokeStyle = "rgba(88, 160, 144, 0.13)";
        for (let line = -8; line <= 12; line++) {
            this.camera.project(-10, 0, line, this.projected);
            this.camera.project(10, 0, line, this.projectedSecond);
            line2(context, this.projected, this.projectedSecond);
        }
        for (let line = -10; line <= 10; line++) {
            this.camera.project(line, 0, -8, this.projected);
            this.camera.project(line, 0, 12, this.projectedSecond);
            line2(context, this.projected, this.projectedSecond);
        }

        this.camera.project(scene.targetX, 0, scene.targetZ, this.projected);
        context.strokeStyle = scene.mode === FlyingSwordMode.Focus
            ? "rgba(255, 183, 83, 0.9)"
            : "rgba(101, 221, 191, 0.32)";
        context.lineWidth = 2;
        context.beginPath();
        context.ellipse(
            this.projected.x,
            this.projected.y,
            22,
            10,
            0,
            0,
            Math.PI * 2,
        );
        context.stroke();
    }

    private collectCultivators(cultivators: Cultivators): void {
        const iter = cultivators.iter();
        while (iter.next()) {
            const [count, entities, transforms] = iter.current;
            for (let row = 0; row < count; row++) {
                const x = transforms[Transform3Field.X][row];
                const y = transforms[Transform3Field.Y][row];
                const z = transforms[Transform3Field.Z][row];
                this.camera.project(x, y, z, this.projected);
                this.camera.project(x, y + 1.75, z, this.projectedSecond);
                const item = this.queue.acquire();
                item.kind = RenderKind.Cultivator;
                item.sprite = 0;
                item.layer = FlyingSwordRenderLayer.World;
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
            for (let row = 0; row < count; row++) {
                const x = lerp(
                    data[FlyingSwordField.PreviousX][row],
                    data[FlyingSwordField.X][row],
                    interpolation,
                );
                const y = lerp(
                    data[FlyingSwordField.PreviousY][row],
                    data[FlyingSwordField.Y][row],
                    interpolation,
                );
                const z = lerp(
                    data[FlyingSwordField.PreviousZ][row],
                    data[FlyingSwordField.Z][row],
                    interpolation,
                );
                const forwardX = data[FlyingSwordField.ForwardX][row];
                const forwardY = data[FlyingSwordField.ForwardY][row];
                const forwardZ = data[FlyingSwordField.ForwardZ][row];
                const entity = entities[row];
                const spriteIndex =
                    data[FlyingSwordField.VisualId][row] % this.swordSprites.length;

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
                shadow.layer = FlyingSwordRenderLayer.Shadow;
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
                sword.layer = FlyingSwordRenderLayer.World;
                sword.depth = (this.projected.depth + this.projectedSecond.depth) * 0.5;
                sword.subOrder = 1;
                sword.stableId = entity * 4 + 1;
                sword.x1 = this.projected.x;
                sword.y1 = this.projected.y;
                sword.x2 = this.projectedSecond.x;
                sword.y2 = this.projectedSecond.y;
                sword.color = SWORD_COLORS[
                    data[FlyingSwordField.VisualId][row] % SWORD_COLORS.length
                ];
                this.swordCount++;
                this.nearestDepth = Math.min(this.nearestDepth, sword.depth);
                this.farthestDepth = Math.max(this.farthestDepth, sword.depth);
                this.minimumHeight = Math.min(this.minimumHeight, y);
                this.maximumHeight = Math.max(this.maximumHeight, y);
            }
        }
    }

    private drawSortedItems(): void {
        const context = this.view.context;
        for (const item of this.queue.items) {
            if (item.kind === RenderKind.Shadow) {
                const sprite = this.swordSprites[item.sprite];
                if (sprite.image.complete && sprite.image.naturalWidth > 0) {
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
                if (sprite.image.complete && sprite.image.naturalWidth > 0) {
                    drawSwordSprite(context, item, sprite);
                } else {
                    drawSwordFallback(context, item);
                }
            }
        }
    }

    private drawStatus(scene: Readonly<DemoSceneState>): void {
        const mode = scene.mode === FlyingSwordMode.Focus
            ? "集中"
            : scene.mode === FlyingSwordMode.Recall
                ? "召回"
                : "环绕";
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
            `飞剑数量  ${this.swordCount}`,
            `当前指令  ${mode}`,
            "",
            `目标 X    ${scene.targetX.toFixed(2)}`,
            `目标 Y    ${scene.targetY.toFixed(2)}`,
            `目标 Z    ${scene.targetZ.toFixed(2)}`,
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
    readonly image: HTMLImageElement;
    readonly sourceX: number;
    readonly sourceY: number;
    readonly sourceWidth: number;
    readonly sourceHeight: number;
}

const SWORD_SPRITES = [
    {
        url: swordJadeUrl,
        sourceX: 93,
        sourceY: 259,
        sourceWidth: 1751,
        sourceHeight: 433,
    },
    {
        url: swordFlameUrl,
        sourceX: 148,
        sourceY: 230,
        sourceWidth: 1858,
        sourceHeight: 267,
    },
    {
        url: swordFrostUrl,
        sourceX: 100,
        sourceY: 302,
        sourceWidth: 1723,
        sourceHeight: 220,
    },
    {
        url: swordThunderUrl,
        sourceX: 76,
        sourceY: 325,
        sourceWidth: 1621,
        sourceHeight: 244,
    },
] as const;

function line2(
    context: CanvasRenderingContext2D,
    from: Readonly<ProjectedPoint>,
    to: Readonly<ProjectedPoint>,
): void {
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
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
        NOMINAL_SWORD_SPRITE_WIDTH * sprite.sourceHeight / sprite.sourceWidth;
    const centerX = (item.x1 + item.x2) * 0.5;
    const centerY = (item.y1 + item.y2) * 0.5;

    context.save();
    context.translate(centerX, centerY);
    context.rotate(Math.atan2(dy, dx));
    if (shadow) {
        // 复用飞剑原图 Alpha，把所有非透明像素绘制为黑色。
        context.filter = "brightness(0)";
        context.globalAlpha = 0.3;
    } else {
        context.shadowColor = item.color;
        context.shadowBlur = 9;
    }
    context.drawImage(
        sprite.image,
        sprite.sourceX,
        sprite.sourceY,
        sprite.sourceWidth,
        sprite.sourceHeight,
        -width * 0.5,
        -height * 0.5,
        width,
        height,
    );
    context.restore();
}

function drawSwordFallback(
    context: CanvasRenderingContext2D,
    item: Readonly<DemoRenderItem>,
    shadow = false,
): void {
    context.shadowColor = shadow ? "transparent" : item.color;
    context.shadowBlur = shadow ? 0 : 13;
    context.strokeStyle = shadow ? "rgba(0, 0, 0, 0.3)" : item.color;
    context.lineWidth = shadow ? 6 : 4;
    context.beginPath();
    context.moveTo(item.x1, item.y1);
    context.lineTo(item.x2, item.y2);
    context.stroke();
    if (!shadow) {
        context.shadowBlur = 0;
        context.strokeStyle = "#effffa";
        context.lineWidth = 1.25;
        context.stroke();
    }
}

const NOMINAL_SWORD_SPRITE_WIDTH = 84;
