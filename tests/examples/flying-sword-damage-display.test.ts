import {
    expect,
    test,
} from "@rstest/core";
import {
    CommandModule,
    Commands,
    GameBuilder,
    Startup,
    defSystem,
} from "@zero-ecs/game";
import {
    FixedTimeResource,
    TimeModule,
} from "@zero-ecs/game/time";
import {
    Float3,
    Position3Type,
} from "@zero-ecs/math/3d";
import {
    DamageDisplay,
    DamageDisplayStyle,
} from "../../examples/flying-sword/src/damage-display/components";
import {
    FlyingSwordDamageDisplayModule,
} from "../../examples/flying-sword/src/damage-display/module";
import {
    DamageDisplayQuery,
} from "../../examples/flying-sword/src/damage-display/queries";
import {
    CultivatorTag,
} from "../../examples/flying-sword/src/simulation/components";
import {
    DamageKind,
    DamageRequest,
    DamageRequestType,
    Health,
    HealthType,
} from "../../examples/flying-sword/src/simulation/rogue/components";
import {
    RogueDamageRequestQuery,
} from "../../examples/flying-sword/src/simulation/rogue/queries";
import {
    RogueEntityAccessState,
} from "../../examples/flying-sword/src/simulation/rogue/state";
import {
    resolveRogueDamageSystem,
} from "../../examples/flying-sword/src/simulation/rogue/systems";

const setupDamageDisplaySystem = defSystem(
    Startup,
    (commands: Commands): void => {
        const target = commands.spawn();
        target
            .add(Position3Type)
            .add(CultivatorTag)
            .add(HealthType)
            .set(Position3Type, Float3.X, 2)
            .set(Position3Type, Float3.Y, 0)
            .set(Position3Type, Float3.Z, -1)
            .set(HealthType, Health.Current, 100)
            .set(HealthType, Health.Maximum, 100)
            .submit();
        commands
            .spawn()
            .add(DamageRequestType)
            .set(DamageRequestType, DamageRequest.Source, target.entity)
            .set(DamageRequestType, DamageRequest.Target, target.entity)
            .set(DamageRequestType, DamageRequest.Amount, 17.5)
            .set(
                DamageRequestType,
                DamageRequest.Kind,
                DamageKind.Generic,
            )
            .submit();
    },
    [Commands],
);

test("damage display module captures one number and expires it", () => {
    const builder = new GameBuilder()
        .addModule(new CommandModule())
        .addModule(new TimeModule(new FixedTimeResource(1 / 60)))
        .addState(RogueEntityAccessState)
        .addModule(new FlyingSwordDamageDisplayModule());
    builder.addSystem(setupDamageDisplaySystem);
    builder.addSystem(resolveRogueDamageSystem);
    const game = builder.build();
    game.init();
    game.start();

    for (let tick = 0; tick < 3; tick++) game.update();
    const iter = game.world.query(DamageDisplayQuery).iter();
    expect(iter.next()).toBe(true);
    const [count, , positions, displays] = iter.current;
    expect(count).toBe(1);
    expect(positions[Float3.X][0]).toBe(2);
    expect(positions[Float3.Z][0]).toBe(-1);
    expect(displays[DamageDisplay.Amount][0]).toBeCloseTo(17.5);
    expect(displays[DamageDisplay.Style][0]).toBe(
        DamageDisplayStyle.Taken,
    );
    let requests = 0;
    const requestIter = game.world.query(RogueDamageRequestQuery).iter();
    while (requestIter.next()) requests += requestIter.current[0];
    expect(requests).toBe(0);

    for (let tick = 0; tick < 45; tick++) game.update();
    let remaining = 0;
    const expiredIter = game.world.query(DamageDisplayQuery).iter();
    while (expiredIter.next()) remaining += expiredIter.current[0];
    expect(remaining).toBe(0);

    game.dispose();
});

const setupFlyingSwordDamageStylesSystem = defSystem(
    Startup,
    (commands: Commands): void => {
        const target = commands.spawn();
        target
            .add(Position3Type)
            .add(HealthType)
            .set(Position3Type, Float3.X, 0)
            .set(Position3Type, Float3.Y, 0)
            .set(Position3Type, Float3.Z, 0)
            .set(HealthType, Health.Current, 1000)
            .set(HealthType, Health.Maximum, 1000)
            .submit();
        const kinds = [
            DamageKind.ScatterSword,
            DamageKind.FocusSword,
            DamageKind.FormationSword,
            DamageKind.SwordBodyUnity,
        ] as const;
        for (let index = 0; index < kinds.length; index++) {
            commands
                .spawn()
                .add(DamageRequestType)
                .set(
                    DamageRequestType,
                    DamageRequest.Source,
                    target.entity,
                )
                .set(
                    DamageRequestType,
                    DamageRequest.Target,
                    target.entity,
                )
                .set(DamageRequestType, DamageRequest.Amount, 10)
                .set(
                    DamageRequestType,
                    DamageRequest.Kind,
                    kinds[index],
                )
                .submit();
        }
    },
    [Commands],
);

test("damage display preserves distinct flying sword impact styles", () => {
    const builder = new GameBuilder()
        .addModule(new CommandModule())
        .addModule(new TimeModule(new FixedTimeResource(1 / 60)))
        .addState(RogueEntityAccessState)
        .addModule(new FlyingSwordDamageDisplayModule());
    builder.addSystem(setupFlyingSwordDamageStylesSystem);
    builder.addSystem(resolveRogueDamageSystem);
    const game = builder.build();
    game.init();
    game.start();

    for (let tick = 0; tick < 3; tick++) game.update();
    const styles = new Set<number>();
    const iter = game.world.query(DamageDisplayQuery).iter();
    while (iter.next()) {
        const [count, , , displays] = iter.current;
        const values = displays[DamageDisplay.Style];
        for (let row = 0; row < count; row++) {
            styles.add(values[row]);
        }
    }
    expect(styles).toEqual(new Set([
        DamageDisplayStyle.ScatterSword,
        DamageDisplayStyle.FocusSword,
        DamageDisplayStyle.FormationSword,
        DamageDisplayStyle.SwordBodyUnity,
    ]));

    game.dispose();
});
