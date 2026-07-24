import {
    Inject,
    World,
    type Entity,
} from "@zero-ecs/game";
import {
    FlyingSwordSpatialService,
} from "@zero-ecs/flying-sword/integration";
import type { Vector3Out } from "@zero-ecs/flying-sword";
import {
    Transform3Field,
    Transform3Type,
} from "./components";

/** 将示例自己的 Transform3 适配给飞剑库。 */
export class DemoFlyingSwordSpatialService extends FlyingSwordSpatialService {
    @Inject.world() private readonly world!: World;

    readPosition(entity: Entity, out: Vector3Out): boolean {
        const x = this.world.get(entity, Transform3Type, Transform3Field.X);
        if (x === null) return false;
        const y = this.world.get(entity, Transform3Type, Transform3Field.Y);
        const z = this.world.get(entity, Transform3Type, Transform3Field.Z);
        if (y === null || z === null) return false;
        out.x = x;
        out.y = y;
        out.z = z;
        return true;
    }
}
