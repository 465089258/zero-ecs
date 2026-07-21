import { Resource } from "@zero-ecs/game";
import { rgb } from "../core";

export class ProjectileRenderConfig extends Resource {
    readonly color = rgb(0xffe082);
    readonly glow = 6;
}
