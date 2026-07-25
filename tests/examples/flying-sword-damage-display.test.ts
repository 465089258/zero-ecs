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
    DamageRequest,
    DamageRequestType,
} from "../../examples/flying-sword/src/simulation/rogue/components";

const setupDamageDisplaySystem = defSystem(
    Startup,
    (commands: Commands): void => {
        const target = commands.spawn();
        target
            .add(Position3Type)
            .add(CultivatorTag)
            .set(Position3Type, Float3.X, 2)
            .set(Position3Type, Float3.Y, 0)
            .set(Position3Type, Float3.Z, -1)
            .submit();
        commands
            .spawn()
            .add(DamageRequestType)
            .set(DamageRequestType, DamageRequest.Source, target.entity)
            .set(DamageRequestType, DamageRequest.Target, target.entity)
            .set(DamageRequestType, DamageRequest.Amount, 17.5)
            .submit();
    },
    [Commands],
);

test("damage display module captures one number and expires it", () => {
    const builder = new GameBuilder()
        .addModule(new CommandModule())
        .addModule(new TimeModule(new FixedTimeResource(1 / 60)))
        .addModule(new FlyingSwordDamageDisplayModule());
    builder.addSystem(setupDamageDisplaySystem);
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

    for (let tick = 0; tick < 45; tick++) game.update();
    let remaining = 0;
    const expiredIter = game.world.query(DamageDisplayQuery).iter();
    while (expiredIter.next()) remaining += expiredIter.current[0];
    expect(remaining).toBe(0);

    game.dispose();
});
