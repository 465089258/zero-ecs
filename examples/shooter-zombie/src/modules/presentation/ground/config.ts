import { Resource } from "@zero-ecs/game";
import { linearGradient, rgb, rgba } from "../core";

export class GroundRenderConfig extends Resource {
    readonly background = linearGradient({
        start: rgb(0x0b1a0b),
        middle: rgb(0x0f1f0f),
        end: rgb(0x081408),
    });
    readonly gridColor = rgba(50, 90, 50, 38);
    readonly gridSize = 48;
}
