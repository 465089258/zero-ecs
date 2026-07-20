import { Resource } from "zero-ecs-lib";
export class WallConfig extends Resource {
    readonly x = 210; readonly y = 320;
    readonly halfWidth = 12; readonly halfHeight = 260;
    readonly initialHp = 2000;
}
