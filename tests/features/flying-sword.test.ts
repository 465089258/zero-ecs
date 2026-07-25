import {
    expect,
    test,
} from "@rstest/core";
import {
    CommandModule,
    Commands,
    GameBuilder,
    INVALID_ENTITY,
    type Entity,
} from "@zero-ecs/game";
import {
    FixedTimeResource,
    TimeModule,
} from "@zero-ecs/game/time";
import {
    FlyingSwordAction,
    FlyingSwordActionQuery,
    FlyingSwordControl,
    FlyingSwordGroupQuery,
    FlyingSwordMode,
    FlyingSwordModule,
    PiercingCloudSkillPlan,
    FlyingSwordQuery,
    FlyingSwordService,
    FlyingSwordSkillAction,
    FlyingSwordSkillActionQuery,
    FlyingSwordSkillPhase,
    FlyingSwordSkillService,
    FlyingSwordSkillTiming,
} from "@zero-ecs/flying-sword";
import {
    Direction3Type,
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
    const [
        count,
        ,
        ,
        previousPositions,
        positions,
        directions,
    ] =
        swordIter.current;
    expect(count).toBe(1);
    expect(positions[Float3.Y][0]).toBeGreaterThan(0.5);
    expect(previousPositions[Float3.Y][0]).toBe(0.5);
    expect(directions[Float3.X][0]).toBe(0);
    expect(directions[Float3.Y][0]).toBe(1);
    expect(directions[Float3.Z][0]).toBe(0);

    flyingSwords.focus(group, { x: 4, y: 0, z: 5 });
    // 第一次更新提交请求实体，第二次固定帧消费请求。
    game.update();
    game.update();
    const groupIter = game.world.query(FlyingSwordGroupQuery).iter();
    expect(groupIter.next()).toBe(true);
    const [, , , , targets, , controls] = groupIter.current;
    expect(controls[FlyingSwordControl.Mode][0]).toBe(FlyingSwordMode.Focus);
    expect(targets[Float3.X][0]).toBe(4);
    expect(targets[Float3.Z][0]).toBe(5);

    game.dispose();
});

test("recalled flying swords form an animated directional fan behind their owner", () => {
    const game = new GameBuilder()
        .addModule(new CommandModule())
        .addModule(new TimeModule(new FixedTimeResource(1 / 60)))
        .addModule(new Motion3Module())
        .addModule(new FlyingSwordModule())
        .build();
    game.init();
    game.start();

    const ownerCommand = game.service(Commands).spawn();
    const owner = ownerCommand.entity;
    ownerCommand
        .add(Direction3Type)
        .set(Direction3Type, Float3.X, 0)
        .set(Direction3Type, Float3.Y, 0)
        .set(Direction3Type, Float3.Z, 1)
        .submit();

    const flyingSwords = game.service(FlyingSwordService);
    const swordCount = 7;
    const group = flyingSwords.createGroup({
        owner,
        center: { x: 0, y: 0, z: 0 },
        formationSize: swordCount,
        orbitRadius: 2,
        orbitHeight: 1.5,
    });
    for (let slot = 0; slot < swordCount; slot++) {
        flyingSwords.createSword({
            group,
            position: { x: 0, y: 1, z: 0 },
            slot,
            maximumSpeed: 20,
            acceleration: 60,
        });
    }
    game.update();
    flyingSwords.recall(group);
    for (let tick = 0; tick < 120; tick++) game.update();

    let minimumX = Number.POSITIVE_INFINITY;
    let maximumX = Number.NEGATIVE_INFINITY;
    let maximumZ = Number.NEGATIVE_INFINITY;
    let minimumDirectionX = Number.POSITIVE_INFINITY;
    let maximumDirectionX = Number.NEGATIVE_INFINITY;
    const initialYs = new Map<Entity, number>();
    let visited = 0;
    const iter = game.world.query(FlyingSwordQuery).iter();
    while (iter.next()) {
        const [count, entities, , , positions, directions] =
            iter.current;
        const xs = positions[Float3.X];
        const ys = positions[Float3.Y];
        const zs = positions[Float3.Z];
        const directionXs = directions[Float3.X];
        const directionYs = directions[Float3.Y];
        const directionZs = directions[Float3.Z];
        for (let row = 0; row < count; row++) {
            minimumX = Math.min(minimumX, xs[row]);
            maximumX = Math.max(maximumX, xs[row]);
            maximumZ = Math.max(maximumZ, zs[row]);
            minimumDirectionX = Math.min(
                minimumDirectionX,
                directionXs[row],
            );
            maximumDirectionX = Math.max(
                maximumDirectionX,
                directionXs[row],
            );
            expect(directionYs[row]).toBeGreaterThan(0.8);
            expect(Math.abs(directionZs[row])).toBeLessThan(1e-6);
            initialYs.set(entities[row], ys[row]);
            visited++;
        }
    }
    expect(visited).toBe(swordCount);
    expect(minimumX).toBeLessThan(-1);
    expect(maximumX).toBeGreaterThan(1);
    expect(maximumZ).toBeLessThan(-0.5);
    expect(minimumDirectionX).toBeLessThan(-0.4);
    expect(maximumDirectionX).toBeGreaterThan(0.4);

    for (let tick = 0; tick < 18; tick++) game.update();
    let maximumVerticalChange = 0;
    const animatedIter = game.world.query(FlyingSwordQuery).iter();
    while (animatedIter.next()) {
        const [count, entities, , , positions] =
            animatedIter.current;
        const ys = positions[Float3.Y];
        for (let row = 0; row < count; row++) {
            const initialY = initialYs.get(entities[row]);
            expect(initialY).toBeDefined();
            maximumVerticalChange = Math.max(
                maximumVerticalChange,
                Math.abs(ys[row] - initialY!),
            );
        }
    }
    expect(maximumVerticalChange).toBeGreaterThan(0.03);

    game.dispose();
});

test("flying sword requests update their target groups across multiple chunks", () => {
    const game = new GameBuilder()
        .addModule(new CommandModule())
        .addModule(new TimeModule(new FixedTimeResource(1 / 60)))
        .addModule(new Motion3Module())
        .addModule(new FlyingSwordModule())
        .build();
    game.init();
    game.start();

    const flyingSwords = game.service(FlyingSwordService);
    const expectedCenters =
        new Map<Entity, readonly [number, number, number]>();
    const groupCount = 320;
    for (let index = 0; index < groupCount; index++) {
        const group = flyingSwords.createGroup({
            owner: INVALID_ENTITY,
            formationSize: 1,
        });
        expectedCenters.set(group, [index, index * 2, -index]);
    }
    game.update();

    for (const [group, center] of expectedCenters) {
        flyingSwords.setCenter(group, {
            x: center[0],
            y: center[1],
            z: center[2],
        });
    }
    game.update();
    game.update();

    let visited = 0;
    const iter = game.world.query(FlyingSwordGroupQuery).iter();
    while (iter.next()) {
        const [count, entities, , centers] = iter.current;
        const centerXs = centers[Float3.X];
        const centerYs = centers[Float3.Y];
        const centerZs = centers[Float3.Z];
        for (let row = 0; row < count; row++) {
            const expected = expectedCenters.get(entities[row]);
            expect(expected).toBeDefined();
            expect(centerXs[row]).toBe(expected![0]);
            expect(centerYs[row]).toBe(expected![1]);
            expect(centerZs[row]).toBe(expected![2]);
            visited++;
        }
    }
    expect(visited).toBe(groupCount);

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
    let observedActionEntity = false;
    for (let tick = 0; tick < 600; tick++) {
        game.update();
        const phase = skills.phase(group);
        observed.add(phase);
        const skillActionIter =
            game.world.query(FlyingSwordSkillActionQuery).iter();
        while (skillActionIter.next()) {
            const [
                actionCount,
                ,
                actionIdentity,
                ,
                actionTiming,
            ] = skillActionIter.current;
            if (actionCount > 0 && !observedActionEntity) {
                expect(
                    actionIdentity[FlyingSwordSkillAction.Group][0],
                ).toBe(group);
                expect(
                    actionIdentity[FlyingSwordSkillAction.Sequence][0],
                ).toBe(skills.sequence(group));
                expect(
                    actionTiming[
                        FlyingSwordSkillTiming.DisplayPhase
                    ][0],
                ).toBe(phase);
                observedActionEntity = true;
            }
        }
        if (phase === FlyingSwordSkillPhase.Idle && tick > 0) break;
    }
    expect(observed.has(FlyingSwordSkillPhase.Gather)).toBe(true);
    expect(observed.has(FlyingSwordSkillPhase.Launch)).toBe(true);
    expect(observed.has(FlyingSwordSkillPhase.Strike)).toBe(true);
    expect(observed.has(FlyingSwordSkillPhase.Return)).toBe(true);
    expect(observed.has(FlyingSwordSkillPhase.Rejoin)).toBe(true);
    expect(observedActionEntity).toBe(true);
    expect(skills.phase(group)).toBe(FlyingSwordSkillPhase.Idle);

    const skillActionIter =
        game.world.query(FlyingSwordSkillActionQuery).iter();
    let activeActionCount = 0;
    while (skillActionIter.next()) {
        activeActionCount += skillActionIter.current[0];
    }
    expect(activeActionCount).toBe(0);

    const actionIter = game.world.query(FlyingSwordActionQuery).iter();
    let activeSwordCount = 0;
    while (actionIter.next()) {
        activeSwordCount += actionIter.current[0];
    }
    expect(activeSwordCount).toBe(0);
    game.dispose();
});

test("flying sword request entities use deterministic command precedence", () => {
    const game = new GameBuilder()
        .addModule(new CommandModule())
        .addModule(new TimeModule(new FixedTimeResource(1 / 60)))
        .addModule(new Motion3Module())
        .addModule(new FlyingSwordModule())
        .build();
    game.init();
    game.start();

    const flyingSwords = game.service(FlyingSwordService);
    const group = flyingSwords.createGroup({
        owner: INVALID_ENTITY,
        formationSize: 1,
    });
    game.update();

    flyingSwords.focus(group, { x: 2, y: 3, z: 4 });
    flyingSwords.recall(group);
    game.update();
    game.update();

    const iter = game.world.query(FlyingSwordGroupQuery).iter();
    expect(iter.next()).toBe(true);
    const [, , , , target, , control] = iter.current;
    expect(target[Float3.X][0]).toBe(2);
    expect(target[Float3.Y][0]).toBe(3);
    expect(target[Float3.Z][0]).toBe(4);
    expect(control[FlyingSwordControl.Mode][0])
        .toBe(FlyingSwordMode.Recall);

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
