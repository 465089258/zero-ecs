import {
    State,
    type Entity,
} from "@zero-ecs/game";

/** @internal 单帧取消请求的零分配查找表。 */
export class FlyingSwordTaskCancellationState extends State {
    readonly groups = new Set<Entity>();
    readonly immediateGroups = new Set<Entity>();

    dispose(): void {
        this.groups.clear();
        this.immediateGroups.clear();
    }
}
