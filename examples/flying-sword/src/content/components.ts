import {
    Types,
    type Component,
} from "@zero-ecs/game";

/** 示例内容层为飞剑选择的表现资源，不属于飞剑领域库。 */
export enum FlyingSwordVisual {
    Id,
}

export class FlyingSwordVisualType
implements Component<FlyingSwordVisual> {
    readonly [FlyingSwordVisual.Id] = Types.U16;
}
