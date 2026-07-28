import {
    expect,
    test,
} from "@rstest/core";
import {
    CommandModule,
    Commands,
    GameBuilder,
    Startup,
    Write,
    defSystem,
    type Mut,
} from "@zero-ecs/game";
import {
    FixedTimeResource,
    TimeModule,
} from "@zero-ecs/game/time";
import {
    Direction3Type,
    Float3,
    Position3Type,
    PreviousPosition3Type,
    Velocity3Type,
} from "../../examples/flying-sword/src/infrastructure/math";
import {
    DemoMotionModule as Motion3Module,
    MoveTowards3,
    MoveTowards3Type,
} from "../../examples/flying-sword/src/infrastructure/motion";
import {
    FlyingSwordActionQuery,
    FlyingSwordAction,
    FlyingSwordFormation,
    FlyingSwordGroupQuery,
    FlyingSwordMode,
    FlyingSwordModule,
    FlyingSwordQuery,
    FlyingSwordService,
    FlyingSwordSkillPhase,
    FlyingSwordSkillService,
} from "../../examples/flying-sword/src/domain/flying-sword";
import {
    CultivatorMoveActiveTag,
    CultivatorQuery,
    CultivatorTag,
    MovingCultivatorQuery,
} from "../../examples/flying-sword/src/simulation/components";
import { DemoSceneState } from "../../examples/flying-sword/src/simulation/state";
import {
    DemoMovementResultSystemOptions,
    resolveCultivatorMovementSystem,
} from "../../examples/flying-sword/src/simulation/systems";

const setupMovingCultivatorSystem = defSystem(
    Startup,
    setupMovingCultivator,
    [Commands, Write(DemoSceneState)],
);

function setupMovingCultivator(
    commands: Commands,
    scene: Mut<DemoSceneState>,
): void {
    const command = commands.spawn();
    scene.cultivator = command.entity;
    scene.hasMoveTarget = true;
    command
        .add(Position3Type)
        .add(PreviousPosition3Type)
        .add(Velocity3Type)
        .add(Direction3Type)
        .add(MoveTowards3Type)
        .add(CultivatorMoveActiveTag)
        .add(CultivatorTag)
        .set(Position3Type, Float3.X, 0)
        .set(Position3Type, Float3.Y, 0)
        .set(Position3Type, Float3.Z, 0)
        .set(PreviousPosition3Type, Float3.X, 0)
        .set(PreviousPosition3Type, Float3.Y, 0)
        .set(PreviousPosition3Type, Float3.Z, 0)
        .set(Velocity3Type, Float3.X, 0)
        .set(Velocity3Type, Float3.Y, 0)
        .set(Velocity3Type, Float3.Z, 0)
        .set(Direction3Type, Float3.X, 1)
        .set(Direction3Type, Float3.Y, 0)
        .set(Direction3Type, Float3.Z, 0)
        .set(MoveTowards3Type, MoveTowards3.TargetX, 1)
        .set(MoveTowards3Type, MoveTowards3.TargetY, 0)
        .set(MoveTowards3Type, MoveTowards3.TargetZ, 0)
        .set(MoveTowards3Type, MoveTowards3.MaximumSpeed, 1)
        .set(MoveTowards3Type, MoveTowards3.Acceleration, 20)
        .set(MoveTowards3Type, MoveTowards3.ArrivalRadius, 0.01)
        .submit();
}

const setupSwordCommandSystem = defSystem(
    Startup,
    setupSwordCommand,
    [Commands, FlyingSwordService, Write(DemoSceneState)],
);

function setupSwordCommand(
    commands: Commands,
    flyingSwords: FlyingSwordService,
    scene: Mut<DemoSceneState>,
): void {
    const cultivator = commands.spawn();
    scene.cultivator = cultivator.entity;
    cultivator
        .add(Position3Type)
        .add(PreviousPosition3Type)
        .set(Position3Type, Float3.X, 0)
        .set(Position3Type, Float3.Y, 0)
        .set(Position3Type, Float3.Z, 0)
        .set(PreviousPosition3Type, Float3.X, 0)
        .set(PreviousPosition3Type, Float3.Y, 0)
        .set(PreviousPosition3Type, Float3.Z, 0)
        .submit();

    const group = flyingSwords.createGroup({
        owner: cultivator.entity,
        center: { x: 0, y: 0, z: 0 },
        formationSize: 2,
        orbitRadius: 1,
        orbitHeight: 1,
    });
    flyingSwords.createSword({
        group,
        position: { x: 0, y: 1, z: 0 },
        maximumSpeed: 10,
        acceleration: 20,
    });
    flyingSwords.createSword({
        group,
        position: { x: 0.25, y: 1.1, z: 0 },
        slot: 1,
        maximumSpeed: 10,
        acceleration: 20,
    });
    scene.swordGroup = group;
    scene.targetX = 0;
    scene.targetY = 0;
    scene.targetZ = 6;
    scene.mode = FlyingSwordMode.Orbit;
}

test("cultivator uses generic Motion and retains fixed-tick history", () => {
    const builder = new GameBuilder()
        .addModule(new CommandModule())
        .addModule(new TimeModule(new FixedTimeResource(0.1)))
        .addModule(new Motion3Module())
        .addState(DemoSceneState);
    builder.addSystem(setupMovingCultivatorSystem);
    builder.addSystem(
        resolveCultivatorMovementSystem,
        DemoMovementResultSystemOptions,
    );
    const game = builder.build();
    game.init();
    game.start();

    game.update();
    for (let tick = 0; tick < 40; tick++) game.update();

    const iter = game.world.query(CultivatorQuery).iter();
    expect(iter.next()).toBe(true);
    const [count, , positions, previousPositions] = iter.current;
    expect(count).toBe(1);
    expect(positions[Float3.X][0]).toBeCloseTo(1, 1);
    expect(positions[Float3.Z][0]).toBe(0);
    expect(previousPositions[Float3.X][0]).toBeLessThanOrEqual(1.01);
    const movingIter =
        game.world.query(MovingCultivatorQuery).iter();
    let movingCount = 0;
    while (movingIter.next()) movingCount += movingIter.current[0];
    expect(movingCount).toBe(0);
    expect(game.state(DemoSceneState).hasMoveTarget).toBe(false);

    game.dispose();
});

test("Piercing Cloud gathers, strikes, returns, and removes action components", () => {
    const builder = new GameBuilder()
        .addModule(new CommandModule())
        .addModule(new TimeModule(new FixedTimeResource(0.1)))
        .addModule(new Motion3Module())
        .addState(DemoSceneState)
        .addModule(new FlyingSwordModule());
    builder.addSystem(setupSwordCommandSystem);
    const game = builder.build();
    game.init();
    game.start();

    game.update();
    const skills = game.service(FlyingSwordSkillService);
    const group = game.state(DemoSceneState).swordGroup;
    skills.cast({
        group,
        target: { x: 0, y: 0, z: 6 },
    });

    const observed = new Set<number>();
    for (let tick = 0; tick < 500; tick++) {
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

    const iter = game.world.query(FlyingSwordActionQuery).iter();
    let activeSwordCount = 0;
    while (iter.next()) activeSwordCount += iter.current[0];
    expect(activeSwordCount).toBe(0);

    game.dispose();
});

test("each sword can consume an independent skill target", () => {
    const builder = new GameBuilder()
        .addModule(new CommandModule())
        .addModule(new TimeModule(new FixedTimeResource(0.1)))
        .addModule(new Motion3Module())
        .addState(DemoSceneState)
        .addModule(new FlyingSwordModule());
    builder.addSystem(setupSwordCommandSystem);
    const game = builder.build();
    game.init();
    game.start();
    game.update();

    const group = game.state(DemoSceneState).swordGroup;
    const swordEntities: number[] = [];
    const swordIter = game.world.query(FlyingSwordQuery).iter();
    while (swordIter.next()) {
        const [count, entities] = swordIter.current;
        for (let row = 0; row < count; row++) {
            swordEntities.push(entities[row]);
        }
    }
    expect(swordEntities).toHaveLength(2);

    const skills = game.service(FlyingSwordSkillService);
    skills.setSkillTarget(
        swordEntities[0],
        { x: -3, y: 0.5, z: 7 },
    );
    skills.setSkillTarget(
        swordEntities[1],
        { x: 4, y: 0.75, z: 9 },
    );
    skills.cast({
        group,
        target: { x: 0, y: 0, z: 8 },
    });
    const flyingSwords = game.service(FlyingSwordService);
    flyingSwords.setFormationSize(group, 3);
    for (let tick = 0; tick < 6; tick++) game.update();

    const targets = new Map<number, readonly number[]>();
    const actionIter = game.world.query(FlyingSwordActionQuery).iter();
    while (actionIter.next()) {
        const [count, entities, , actions] = actionIter.current;
        for (let row = 0; row < count; row++) {
            targets.set(entities[row], [
                actions[FlyingSwordAction.TargetX][row],
                actions[FlyingSwordAction.TargetY][row],
                actions[FlyingSwordAction.TargetZ][row],
            ]);
            expect(
                actions[FlyingSwordAction.HasIndividualTarget][row],
            ).toBe(1);
        }
    }
    expect(targets.get(swordEntities[0])).toEqual([-3, 0.5, 7]);
    expect(targets.get(swordEntities[1])).toEqual([4, 0.75, 9]);

    const groupIter = game.world.query(FlyingSwordGroupQuery).iter();
    expect(groupIter.next()).toBe(true);
    const [, , , , , formation] = groupIter.current;
    expect(formation[FlyingSwordFormation.Size][0]).toBe(3);

    game.dispose();
});
