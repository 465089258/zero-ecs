import { Resource } from "@zero-ecs/game";

/** 示例拥有的 DOM 资源；飞剑库本身不知道 Canvas 的存在。 */
export class DemoViewResource extends Resource {
    readonly context: CanvasRenderingContext2D;

    constructor(
        readonly canvas: HTMLCanvasElement,
        readonly status: HTMLElement,
    ) {
        super();
        const context = canvas.getContext("2d", {
            alpha: false,
            desynchronized: true,
        });
        if (!context) throw new Error("Canvas 2D context is unavailable");
        this.context = context;
    }
}
