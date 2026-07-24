import {
    expect,
    test,
} from "@rstest/core";
import {
    CommandModule,
    GameBuilder,
    INVALID_ENTITY,
    type Entity,
} from "@zero-ecs/game";
import {
    FixedTimeResource,
    TimeModule,
} from "@zero-ecs/game/time";
import {
    FlyingSwordField,
    FlyingSwordGroupField,
    FlyingSwordGroupQuery,
    FlyingSwordMode,
    FlyingSwordModule,
    FlyingSwordQuery,
    FlyingSwordService,
    type Vector3Out,
} from "@zero-ecs/flying-sword";
import {
    FlyingSwordSpatialService,
} from "@zero-ecs/flying-sword/integration";

class FixedSpatialService extends FlyingSwordSpatialService {
    readPosition(_entity: Entity, _out: Vector3Out): boolean {
        return false;
    }
}

test("flying sword runtime commits entities and advances authoritative XYZ motion", () => {
    const game = new GameBuilder()
        .addModule(new CommandModule())
        .addModule(new TimeModule(new FixedTimeResource(0.1)))
        .addService(FixedSpatialService)
        .addModule(new FlyingSwordModule())
        .build();
    game.init();
    game.start();

    const flyingSwords = game.service(FlyingSwordService);
    const group = flyingSwords.createGroup({
        owner: INVALID_ENTITY,
        center: { x: 0, y: 0, z: 0 },
        formationSize: 1,
        orbitRadius: 2,
        orbitHeight: 2,
        angularSpeed: 1,
    });
    flyingSwords.createSword({
        group,
        position: { x: 0, y: 0.5, z: 0 },
        maximumSpeed: 10,
        acceleration: 20,
    });

    // 第一个 Tick 在 Update.post 提交结构，第二个 Tick 开始批量制导。
    game.update();
    game.update();

    const swordIter = game.world.query(FlyingSwordQuery).iter();
    expect(swordIter.next()).toBe(true);
    const [count, , swords] = swordIter.current;
    expect(count).toBe(1);
    expect(swords[FlyingSwordField.Y][0]).toBeGreaterThan(0.5);
    expect(swords[FlyingSwordField.PreviousY][0]).toBe(0.5);

    flyingSwords.focus(group, { x: 4, y: 0, z: 5 });
    game.update();
    const groupIter = game.world.query(FlyingSwordGroupQuery).iter();
    expect(groupIter.next()).toBe(true);
    const [, , groups] = groupIter.current;
    expect(groups[FlyingSwordGroupField.Mode][0]).toBe(FlyingSwordMode.Focus);
    expect(groups[FlyingSwordGroupField.TargetX][0]).toBe(4);
    expect(groups[FlyingSwordGroupField.TargetZ][0]).toBe(5);

    game.dispose();
});
