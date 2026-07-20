import { Types, type Component } from "zero-ecs-lib";
export const enum Wall { hp, maxHp }
export class WallType implements Component<Wall> {
    readonly [Wall.hp] = Types.F32;
    readonly [Wall.maxHp] = Types.F32;
}
