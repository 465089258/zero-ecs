/** 飞剑示例本地领域运行时。 */
import {
    State,
    type EntityAccess,
} from "@zero-ecs/game";

/**
 * @internal 跨请求复用的实体位置解析结果。
 *
 * 这里只保存技术性 scratch，不承载请求或领域事实。
 */
export class FlyingSwordEntityAccessState extends State {
    readonly access: EntityAccess = {
        archetype: null,
        row: 0 as EntityAccess["row"],
    };

    dispose(): void {
        this.access.archetype = null;
        this.access.row = 0 as EntityAccess["row"];
    }
}
