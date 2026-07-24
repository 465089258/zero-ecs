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
    PiercingCloudSkillPlan,
    FlyingSwordQuery,
    FlyingSwordService,
    FlyingSwordSkillPhase,
    FlyingSwordSkillService,
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

test("Piercing Cloud releases a multi-sword formation after rejoining", () => {
    const game = new GameBuilder()
        .addModule(new CommandModule())
        .addModule(new TimeModule(new FixedTimeResource(1 / 60)))
        .addService(FixedSpatialService)
        .addModule(new FlyingSwordModule())
        .build();
    game.init();
    game.start();

    const flyingSwords = game.service(FlyingSwordService);
    const skills = game.service(FlyingSwordSkillService);
    const swordCount = 81;
    const group = flyingSwords.createGroup({
        owner: INVALID_ENTITY,
        center: { x: 0, y: 0, z: 0 },
        formationSize: swordCount,
        orbitRadius: 3,
        orbitHeight: 1.4,
    });
    for (let slot = 0; slot < swordCount; slot++) {
        flyingSwords.createSword({
            group,
            position: { x: 0, y: 1, z: 0 },
            slot,
            maximumSpeed: 13,
            acceleration: 42,
        });
    }
    game.update();
    skills.cast({
        group,
        target: { x: 2, y: 0, z: 8 },
    });

    const observed = new Set<number>();
    for (let tick = 0; tick < 600; tick++) {
        game.update();
        const phase = skills.phase(group);
        observed.add(phase);
        if (phase === FlyingSwordSkillPhase.Idle && tick > 0) break;
    }
    expect(observed.has(FlyingSwordSkillPhase.Gather)).toBe(true);
    expect(observed.has(FlyingSwordSkillPhase.Launch)).toBe(true);
    expect(observed.has(FlyingSwordSkillPhase.Strike)).toBe(true);
    expect(observed.has(FlyingSwordSkillPhase.Return)).toBe(true);
    expect(observed.has(FlyingSwordSkillPhase.Rejoin)).toBe(true);
    expect(skills.phase(group)).toBe(FlyingSwordSkillPhase.Idle);

    const iter = game.world.query(FlyingSwordQuery).iter();
    while (iter.next()) {
        const [count, , swords] = iter.current;
        for (let row = 0; row < count; row++) {
            expect(swords[FlyingSwordField.ActionSequence][row]).toBe(0);
        }
    }
    game.dispose();
});

test("Piercing Cloud rises above its formation before diving at the target", () => {
    const game = new GameBuilder()
        .addModule(new CommandModule())
        .addModule(new TimeModule(new FixedTimeResource(1 / 60)))
        .addService(FixedSpatialService)
        .addModule(new FlyingSwordModule())
        .build();
    game.init();
    game.start();

    const flyingSwords = game.service(FlyingSwordService);
    const skills = game.service(FlyingSwordSkillService);
    const group = flyingSwords.createGroup({
        owner: INVALID_ENTITY,
        center: { x: 0, y: 0, z: 0 },
        formationSize: 1,
        orbitRadius: 2,
        orbitHeight: 1.4,
    });
    flyingSwords.createSword({
        group,
        position: { x: 0, y: 1.4, z: 0 },
        maximumSpeed: 13,
        acceleration: 42,
    });
    game.update();
    skills.cast({
        group,
        target: { x: 0, y: 0, z: 8 },
    });

    let gatherGoalY = Number.NaN;
    let launchStartY = Number.NaN;
    let launchGoalY = Number.NaN;
    for (let tick = 0; tick < 180; tick++) {
        game.update();
        const iter = game.world.query(FlyingSwordQuery).iter();
        if (!iter.next()) continue;
        const [, , swords] = iter.current;
        const phase = swords[FlyingSwordField.ActionPhase][0];
        if (phase === FlyingSwordSkillPhase.Gather) {
            gatherGoalY = swords[FlyingSwordField.GoalY][0];
        } else if (
            phase === FlyingSwordSkillPhase.Launch &&
            Number.isNaN(launchStartY)
        ) {
            launchStartY = swords[FlyingSwordField.Y][0];
            launchGoalY = swords[FlyingSwordField.GoalY][0];
            break;
        }
    }

    expect(gatherGoalY).toBeCloseTo(PiercingCloudSkillPlan.gatherHeight);
    expect(launchStartY).toBeGreaterThan(
        PiercingCloudSkillPlan.gatherHeight -
        PiercingCloudSkillPlan.gatherArrivalRadius,
    );
    expect(launchGoalY).toBeCloseTo(PiercingCloudSkillPlan.strikeHeight);
    expect(launchStartY - launchGoalY).toBeGreaterThan(3);

    game.dispose();
});
