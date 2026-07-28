import {
    Application,
    Assets,
    Container,
    Graphics,
    Sprite,
    Text,
    Texture,
    type ColorSource,
} from "pixi.js";
import { Resource } from "@zero-ecs/game";
import swordFlameUrl from "../assets/swords/sword-flame-render.png";
import swordFrostUrl from "../assets/swords/sword-frost-render.png";
import swordJadeUrl from "../assets/swords/sword-jade-render.png";
import swordThunderUrl from "../assets/swords/sword-thunder-render.png";
import cultivatorUrl from "../assets/characters/cultivator-render.png";
import bonePuppetUrl from "../assets/monsters/bone-puppet-render.png";
import corruptedBatUrl from "../assets/monsters/corrupted-bat-render.png";
import stoneGolemUrl from "../assets/monsters/stone-golem-render.png";
import swordWraithUrl from "../assets/monsters/sword-wraith-render.png";

const SWORD_TEXTURE_URLS = [
    swordJadeUrl,
    swordFlameUrl,
    swordFrostUrl,
    swordThunderUrl,
] as const;

const ACTOR_TEXTURE_URLS = [
    cultivatorUrl,
    corruptedBatUrl,
    bonePuppetUrl,
    stoneGolemUrl,
    swordWraithUrl,
] as const;

/**
 * 飞剑示例的 PixiJS/WebGL 宿主资源。
 *
 * ECS 表现系统只提交即时绘制命令；DisplayObject 由 Painter 持久池化，
 * 稳定帧不会按实体数量创建 Sprite、Graphics 或 Text。
 */
export class DemoPixiResource extends Resource {
    readonly painter: PixiPainter;

    constructor(
        readonly application: Application,
        readonly swordTextures: readonly Texture[],
        readonly actorTextures: readonly Texture[],
    ) {
        super();
        this.painter = new PixiPainter(application.stage);
    }

    static async create(canvas: HTMLCanvasElement): Promise<DemoPixiResource> {
        const application = new Application();
        await application.init({
            canvas,
            width: 960,
            height: 640,
            preference: "webgl",
            autoStart: false,
            antialias: false,
            autoDensity: false,
            resolution: 1,
            background: "#071012",
            powerPreference: "high-performance",
        });
        const textureUrls = [
            ...SWORD_TEXTURE_URLS,
            ...ACTOR_TEXTURE_URLS,
        ];
        const textures = await Promise.all(
            textureUrls.map(url => Assets.load<Texture>(url)),
        );
        for (let index = 0; index < textures.length; index++) {
            textures[index].source.scaleMode = "nearest";
        }
        const swordCount = SWORD_TEXTURE_URLS.length;
        return new DemoPixiResource(
            application,
            textures.slice(0, swordCount),
            textures.slice(swordCount),
        );
    }

    render(): void {
        this.application.render();
    }

    destroy(): void {
        this.painter.destroy();
        this.application.destroy(
            { removeView: false },
            { children: true, texture: false, textureSource: false },
        );
    }
}

type PaintStyle = ColorSource;

/**
 * 面向现有投影绘制算法的 Pixi 即时绘制器。
 *
 * API 只覆盖示例需要的二维图元。路径最终进入 Pixi Graphics，图片进入
 * Sprite，数字和调试标签进入 Text；它不是 CanvasRenderingContext2D。
 */
export class PixiPainter {
    fillStyle: PaintStyle = "#000000";
    strokeStyle: PaintStyle = "#000000";
    globalAlpha = 1;
    lineWidth = 1;
    font = "10px sans-serif";
    textAlign: CanvasTextAlign = "start";
    textBaseline: CanvasTextBaseline = "alphabetic";
    effectTint: ColorSource | null = null;
    lineCap: CanvasLineCap = "butt";
    lineJoin: CanvasLineJoin = "miter";

    private readonly graphics: Graphics[] = [];
    private readonly sprites: Sprite[] = [];
    private readonly texts: Text[] = [];
    private graphicsUsed = 0;
    private spritesUsed = 0;
    private textsUsed = 0;
    private order = 0;
    private path: Graphics | null = null;
    private transformA = 1;
    private transformB = 0;
    private transformC = 0;
    private transformD = 1;
    private transformX = 0;
    private transformY = 0;
    private pendingTextStroke = false;

    constructor(private readonly root: Container) {
        root.sortableChildren = true;
    }

    beginFrame(): void {
        for (let index = 0; index < this.graphicsUsed; index++) {
            this.graphics[index].visible = false;
        }
        for (let index = 0; index < this.spritesUsed; index++) {
            this.sprites[index].visible = false;
        }
        for (let index = 0; index < this.textsUsed; index++) {
            this.texts[index].visible = false;
        }
        this.graphicsUsed = 0;
        this.spritesUsed = 0;
        this.textsUsed = 0;
        this.order = 0;
        this.path = null;
        this.globalAlpha = 1;
        this.effectTint = null;
        this.setTransform(1, 0, 0, 1, 0, 0);
    }

    beginPath(): void {
        this.path = this.acquireGraphics();
    }

    closePath(): void {
        this.path?.closePath();
    }

    moveTo(x: number, y: number): void {
        this.ensurePath().moveTo(x, y);
    }

    lineTo(x: number, y: number): void {
        this.ensurePath().lineTo(x, y);
    }

    arc(
        x: number,
        y: number,
        radius: number,
        startAngle: number,
        endAngle: number,
    ): void {
        if (isFullCircle(startAngle, endAngle)) {
            this.ensurePath().circle(x, y, radius);
        } else {
            this.ensurePath().arc(x, y, radius, startAngle, endAngle);
        }
    }

    ellipse(
        x: number,
        y: number,
        radiusX: number,
        radiusY: number,
        rotation: number,
        startAngle: number,
        endAngle: number,
    ): void {
        if (rotation === 0 && isFullCircle(startAngle, endAngle)) {
            this.ensurePath().ellipse(x, y, radiusX, radiusY);
            return;
        }
        const path = this.ensurePath();
        const segments = 32;
        const cosine = Math.cos(rotation);
        const sine = Math.sin(rotation);
        for (let index = 0; index <= segments; index++) {
            const angle =
                startAngle + (endAngle - startAngle) * index / segments;
            const localX = Math.cos(angle) * radiusX;
            const localY = Math.sin(angle) * radiusY;
            const pointX = x + localX * cosine - localY * sine;
            const pointY = y + localX * sine + localY * cosine;
            if (index === 0) path.moveTo(pointX, pointY);
            else path.lineTo(pointX, pointY);
        }
    }

    fill(): void {
        const path = this.path;
        if (!path) return;
        path.alpha = this.globalAlpha;
        path.fill(this.fillStyle);
    }

    stroke(): void {
        const path = this.path;
        if (!path) return;
        path.alpha = this.globalAlpha;
        path.stroke({
            color: this.strokeStyle,
            width: this.lineWidth,
            cap: this.lineCap,
            join: this.lineJoin,
        });
    }

    fillRect(x: number, y: number, width: number, height: number): void {
        const graphics = this.acquireGraphics();
        graphics.alpha = this.globalAlpha;
        graphics.rect(x, y, width, height).fill(this.fillStyle);
    }

    drawTexture(
        texture: Texture,
        x: number,
        y: number,
        width: number,
        height: number,
        tint: ColorSource = 0xffffff,
    ): void {
        const sprite = this.acquireSprite();
        sprite.texture = texture;
        sprite.anchor.set(0.5);
        const centerX = x + width * 0.5;
        const centerY = y + height * 0.5;
        sprite.position.set(
            this.transformA * centerX +
                this.transformC * centerY +
                this.transformX,
            this.transformB * centerX +
                this.transformD * centerY +
                this.transformY,
        );
        sprite.rotation = Math.atan2(this.transformB, this.transformA);
        sprite.width = Math.abs(width);
        sprite.height = Math.abs(height);
        const flash = this.effectTint !== null;
        sprite.tint = this.effectTint ?? tint;
        sprite.blendMode = flash ? "add" : "normal";
        sprite.alpha = this.globalAlpha;
    }

    strokeText(_text: string, _x: number, _y: number): void {
        this.pendingTextStroke = true;
    }

    fillText(value: string, x: number, y: number): void {
        const text = this.acquireText();
        const style = text.style;
        const parsed = parseFont(this.font);
        text.text = value;
        text.position.set(x, y);
        text.anchor.set(textAnchorX(this.textAlign), textAnchorY(this.textBaseline));
        text.alpha = this.globalAlpha;
        style.fontFamily = parsed.family;
        style.fontSize = parsed.size;
        style.fontWeight = parsed.weight;
        style.fill = this.fillStyle;
        style.align = this.textAlign === "center" ? "center" : "left";
        style.stroke = this.pendingTextStroke
            ? { color: this.strokeStyle, width: this.lineWidth }
            : { color: this.fillStyle, width: 0 };
        this.pendingTextStroke = false;
    }

    setTransform(
        a: number,
        b: number,
        c: number,
        d: number,
        x: number,
        y: number,
    ): void {
        this.transformA = a;
        this.transformB = b;
        this.transformC = c;
        this.transformD = d;
        this.transformX = x;
        this.transformY = y;
    }

    setLineDash(_segments: readonly number[]): void {
        // Pixi Graphics 不依赖 Canvas 虚线状态。警示路径仍以颜色和透明度区分。
    }

    destroy(): void {
        this.root.removeChildren();
        for (let index = 0; index < this.graphics.length; index++) {
            this.graphics[index].destroy();
        }
        for (let index = 0; index < this.sprites.length; index++) {
            this.sprites[index].destroy();
        }
        for (let index = 0; index < this.texts.length; index++) {
            this.texts[index].destroy();
        }
        this.graphics.length = 0;
        this.sprites.length = 0;
        this.texts.length = 0;
    }

    private ensurePath(): Graphics {
        if (!this.path) this.beginPath();
        return this.path!;
    }

    private acquireGraphics(): Graphics {
        let graphics = this.graphics[this.graphicsUsed];
        if (!graphics) {
            graphics = new Graphics();
            this.graphics.push(graphics);
            this.root.addChild(graphics);
        }
        this.graphicsUsed++;
        graphics.clear();
        graphics.visible = true;
        graphics.alpha = 1;
        graphics.zIndex = this.order++;
        return graphics;
    }

    private acquireSprite(): Sprite {
        let sprite = this.sprites[this.spritesUsed];
        if (!sprite) {
            sprite = new Sprite(Texture.EMPTY);
            this.sprites.push(sprite);
            this.root.addChild(sprite);
        }
        this.spritesUsed++;
        sprite.visible = true;
        sprite.alpha = 1;
        sprite.rotation = 0;
        sprite.tint = 0xffffff;
        sprite.blendMode = "normal";
        sprite.zIndex = this.order++;
        return sprite;
    }

    private acquireText(): Text {
        let text = this.texts[this.textsUsed];
        if (!text) {
            text = new Text({ text: "" });
            text.resolution = 1;
            this.texts.push(text);
            this.root.addChild(text);
        }
        this.textsUsed++;
        text.visible = true;
        text.alpha = 1;
        text.zIndex = this.order++;
        return text;
    }
}

interface ParsedFont {
    readonly family: string;
    readonly size: number;
    readonly weight:
        | "normal"
        | "bold"
        | "bolder"
        | "lighter"
        | "100"
        | "200"
        | "300"
        | "400"
        | "500"
        | "600"
        | "700"
        | "800"
        | "900";
}

const parsedFonts = new Map<string, ParsedFont>();

function parseFont(font: string): ParsedFont {
    const cached = parsedFonts.get(font);
    if (cached) return cached;
    const match = /(?:(\d+|bold|bolder|lighter)\s+)?(\d+)px\s+(.+)/.exec(font);
    const parsed: ParsedFont = match
        ? {
            weight: parseFontWeight(match[1]),
            size: Number(match[2]),
            family: match[3],
        }
        : { weight: "normal", size: 10, family: "sans-serif" };
    parsedFonts.set(font, parsed);
    return parsed;
}

function parseFontWeight(
    value: string | undefined,
): ParsedFont["weight"] {
    if (!value) return "normal";
    return value as ParsedFont["weight"];
}

function textAnchorX(align: CanvasTextAlign): number {
    if (align === "center") return 0.5;
    if (align === "right" || align === "end") return 1;
    return 0;
}

function textAnchorY(baseline: CanvasTextBaseline): number {
    if (baseline === "middle") return 0.5;
    if (
        baseline === "bottom" ||
        baseline === "ideographic" ||
        baseline === "alphabetic"
    ) {
        return 1;
    }
    return 0;
}

function isFullCircle(start: number, end: number): boolean {
    return Math.abs(end - start) >= Math.PI * 2 - 1e-6;
}
