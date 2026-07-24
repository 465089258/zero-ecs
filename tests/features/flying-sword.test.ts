import {
    expect,
    test,
} from "@rstest/core";
import {
    CommandModule,
    GameBuilder,
    INVALID_ENTITY,
} from "@zero-ecs/game";
import {
    FixedTimeResource,
    TimeModule,
} from "@zero-ecs/game/time";
import {
    FlyingSwordAction,
    FlyingSwordActionQuery,
    FlyingSwordGroupField,
    FlyingSwordGroupQuery,
    FlyingSwordMode,
    FlyingSwordModule,
    PiercingCloudSkillPlan,
    FlyingSwordQuery,
    FlyingSwordService,
    FlyingSwordSkillPhase,
    FlyingSwordSkillService,
} from "@zero-ecs/flying-sword";
import {
    Float3,
    Position3Type,
    Velocity3Type,
} from "@zero-ecs/math/3d";
import {
    Motion3Module,
    MoveTowards3,
    MoveTowards3Type,
} from "@zero-ecs/motion/3d";

test("flying sword runtime commits entities and advances authoritative XYZ motion", () => {
    const game = new GameBuilder()
        .addModule(new CommandModule())
        .addModule(new TimeModule(new FixedTimeResource(0.1)))
        .addModule(new Motion3Module())
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
    const [count, , , previousPositions, positions] =
        swordIter.current;
    expect(count).toBe(1);
    expect(positions[Float3.Y][0]).toBeGreaterThan(0.5);
    expect(previousPositions[Float3.Y][0]).toBe(0.5);

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
        .addModule(new Motion3Module())
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

    const actionIter = game.world.query(FlyingSwordActionQuery).iter();
    let activeSwordCount = 0;
    while (actionIter.next()) {
        activeSwordCount += actionIter.current[0];
    }
    expect(activeSwordCount).toBe(0);
    game.dispose();
});

test("Piercing Cloud curves upward from its formation and dives without an apex phase", () => {
    const game = new GameBuilder()
        .addModule(new CommandModule())
        .addModule(new TimeModule(new FixedTimeResource(1 / 60)))
        .addModule(new Motion3Module())
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
    const sword = flyingSwords.createSword({
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
    let peakLaunchY = Number.NEGATIVE_INFINITY;
    let strikeStartY = Number.NaN;
    let observedRising = false;
    let observedDescending = false;
    for (let tick = 0; tick < 180; tick++) {
        game.update();
        const iter = game.world.query(FlyingSwordActionQuery).iter();
        if (!iter.next()) continue;
        const [, entities, , action] = iter.current;
        let row = -1;
        for (
            let actionRow = 0;
            actionRow < iter.current[0];
            actionRow++
        ) {
            if (entities[actionRow] === sword) {
                row = actionRow;
                break;
            }
        }
        if (row < 0) continue;
        const phase = action[FlyingSwordAction.Phase][row];
        const y = game.world.get(sword, Position3Type, Float3.Y);
        const velocityY =
            game.world.get(sword, Velocity3Type, Float3.Y);
        if (y === null || velocityY === null) continue;
        if (phase === FlyingSwordSkillPhase.Gather) {
            gatherGoalY = game.world.get(
                sword,
                MoveTowards3Type,
                MoveTowards3.TargetY,
            ) ?? Number.NaN;
        } else if (phase === FlyingSwordSkillPhase.Launch) {
            if (Number.isNaN(launchStartY)) launchStartY = y;
            peakLaunchY = Math.max(peakLaunchY, y);
            if (velocityY > 0.5) observedRising = true;
            if (observedRising && velocityY < -0.5) {
                observedDescending = true;
            }
        } else if (phase === FlyingSwordSkillPhase.Strike) {
            strikeStartY = y;
            break;
        }
    }

    expect(gatherGoalY).toBeCloseTo(PiercingCloudSkillPlan.gatherHeight);
    expect(peakLaunchY - launchStartY).toBeGreaterThan(1.5);
    expect(observedRising).toBe(true);
    expect(observedDescending).toBe(true);
    expect(strikeStartY).toBeLessThan(peakLaunchY - 1);

    game.dispose();
});
