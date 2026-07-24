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
    type Entity,
    type Mut,
} from "@zero-ecs/game";
import {
    FixedTimeResource,
    TimeModule,
} from "@zero-ecs/game/time";
import {
    FlyingSwordField,
    FlyingSwordMode,
    FlyingSwordModule,
    FlyingSwordQuery,
    FlyingSwordService,
    FlyingSwordSkillPhase,
    FlyingSwordSkillService,
    type Vector3Out,
} from "@zero-ecs/flying-sword";
import {
    FlyingSwordSpatialService,
} from "@zero-ecs/flying-sword/integration";
import {
    CultivatorMovementField,
    CultivatorMovementQuery,
    CultivatorMovementType,
    CultivatorTag,
    Transform3Field,
    Transform3Type,
} from "../../examples/flying-sword/src/simulation/components";
import { DemoSceneState } from "../../examples/flying-sword/src/simulation/state";
import {
    moveCultivatorsSystem,
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
        .add(Transform3Type)
        .add(CultivatorMovementType)
        .add(CultivatorTag)
        .set(Transform3Type, Transform3Field.X, 0)
        .set(Transform3Type, Transform3Field.Y, 0)
        .set(Transform3Type, Transform3Field.Z, 0)
        .set(Transform3Type, Transform3Field.PreviousX, 0)
        .set(Transform3Type, Transform3Field.PreviousY, 0)
        .set(Transform3Type, Transform3Field.PreviousZ, 0)
        .set(CultivatorMovementType, CultivatorMovementField.TargetX, 1)
        .set(CultivatorMovementType, CultivatorMovementField.TargetZ, 0)
        .set(CultivatorMovementType, CultivatorMovementField.Speed, 1)
        .set(
            CultivatorMovementType,
            CultivatorMovementField.StoppingDistance,
            0.01,
        )
        .set(CultivatorMovementType, CultivatorMovementField.Moving, 1)
        .submit();
}

class StaticSpatialService extends FlyingSwordSpatialService {
    readPosition(_entity: Entity, _out: Vector3Out): boolean {
        return false;
    }
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
        .add(Transform3Type)
        .add(CultivatorTag)
        .set(Transform3Type, Transform3Field.X, 0)
        .set(Transform3Type, Transform3Field.Y, 0)
        .set(Transform3Type, Transform3Field.Z, 0)
        .set(Transform3Type, Transform3Field.PreviousX, 0)
        .set(Transform3Type, Transform3Field.PreviousY, 0)
        .set(Transform3Type, Transform3Field.PreviousZ, 0)
        .submit();

    const group = flyingSwords.createGroup({
        owner: cultivator.entity,
        center: { x: 0, y: 0, z: 0 },
        formationSize: 1,
        orbitRadius: 1,
        orbitHeight: 1,
    });
    flyingSwords.createSword({
        group,
        position: { x: 0, y: 1, z: 0 },
        maximumSpeed: 10,
        acceleration: 20,
    });
    scene.swordGroup = group;
    scene.targetX = 0;
    scene.targetY = 0;
    scene.targetZ = 6;
    scene.mode = FlyingSwordMode.Orbit;
}

test("cultivator advances on the XZ ground and retains fixed-tick history", () => {
    const builder = new GameBuilder()
        .addModule(new CommandModule())
        .addModule(new TimeModule(new FixedTimeResource(0.1)))
        .addState(DemoSceneState);
    builder.addSystem(setupMovingCultivatorSystem);
    builder.addSystem(moveCultivatorsSystem);
    const game = builder.build();
    game.init();
    game.start();

    // 第一个 Tick 提交 Startup 中创建的角色，随后十个 Tick 移动一米。
    game.update();
    for (let tick = 0; tick < 10; tick++) game.update();

    const iter = game.world.query(CultivatorMovementQuery).iter();
    expect(iter.next()).toBe(true);
    const [count, , transforms, movements] = iter.current;
    expect(count).toBe(1);
    expect(transforms[Transform3Field.X][0]).toBeCloseTo(1, 5);
    expect(transforms[Transform3Field.Z][0]).toBe(0);
    expect(transforms[Transform3Field.PreviousX][0]).toBeLessThanOrEqual(1);
    expect(movements[CultivatorMovementField.Moving][0]).toBe(0);
    expect(game.state(DemoSceneState).hasMoveTarget).toBe(false);

    game.dispose();
});

test("Piercing Cloud gathers, strikes, returns, and releases its swords", () => {
    const builder = new GameBuilder()
        .addModule(new CommandModule())
        .addModule(new TimeModule(new FixedTimeResource(0.1)))
        .addService(StaticSpatialService)
        .addState(DemoSceneState)
        .addModule(new FlyingSwordModule());
    builder.addSystem(setupSwordCommandSystem);
    const game = builder.build();
    game.init();
    game.start();

    // 第一个 Tick 提交实体，之后从正式飞剑技能入口激活穿云。
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

    const iter = game.world.query(FlyingSwordQuery).iter();
    expect(iter.next()).toBe(true);
    const [, , swords] = iter.current;
    expect(swords[FlyingSwordField.ActionSequence][0]).toBe(0);

    game.dispose();
});
