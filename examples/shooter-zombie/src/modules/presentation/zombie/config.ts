import { Resource } from "@zero-ecs/game";
import { rgb, rgba } from "../core";

export class ZombieRenderConfig extends Resource {
    readonly normalColor = rgb(0x66bb6a);
    readonly damagedColor = rgb(0xef5350);
    readonly eyeColor = rgb(0xffffff);
    readonly pupilColor = rgb(0x000000);
    readonly barBackground = rgba(0, 0, 0, 128);
    readonly healthyColor = rgb(0x66bb6a);
    readonly warningColor = rgb(0xffa726);
    readonly dangerColor = rgb(0xef5350);
    readonly glow = 6;
}
