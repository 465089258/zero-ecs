import {
    expect,
    test,
} from "@rstest/core";
import {
    CommandModule,
    Commands,
    GameBuilder,
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
} from "@zero-ecs/math/3d";
import {
    Motion3Module,
    MoveTowards3,
    MoveTowards3Type,
} from "@zero-ecs/motion/3d";

test("Motion3 moves ECS components toward a target without temporary result data", () => {
    const game = new GameBuilder()
        .addModule(new CommandModule())
        .addModule(new TimeModule(new FixedTimeResource(0.1)))
        .addModule(new Motion3Module())
        .build();
    game.init();
    game.start();

    const command = game.service(Commands).spawn();
    const entity = command.entity;
    command
        .add(Position3Type)
        .add(PreviousPosition3Type)
        .add(Velocity3Type)
        .add(Direction3Type)
        .add(MoveTowards3Type)
        .set(Position3Type, Float3.X, 0)
        .set(Position3Type, Float3.Y, 0)
        .set(Position3Type, Float3.Z, 0)
        .set(PreviousPosition3Type, Float3.X, 0)
        .set(PreviousPosition3Type, Float3.Y, 0)
        .set(PreviousPosition3Type, Float3.Z, 0)
        .set(Velocity3Type, Float3.X, 0)
        .set(Velocity3Type, Float3.Y, 0)
        .set(Velocity3Type, Float3.Z, 0)
        .set(Direction3Type, Float3.X, 0)
        .set(Direction3Type, Float3.Y, 0)
        .set(Direction3Type, Float3.Z, 1)
        .set(MoveTowards3Type, MoveTowards3.TargetX, 2)
        .set(MoveTowards3Type, MoveTowards3.TargetY, 1)
        .set(MoveTowards3Type, MoveTowards3.TargetZ, 0)
        .set(MoveTowards3Type, MoveTowards3.MaximumSpeed, 2)
        .set(MoveTowards3Type, MoveTowards3.Acceleration, 100)
        .set(MoveTowards3Type, MoveTowards3.ArrivalRadius, 0.01)
        .submit();

    game.update();
    game.update();

    const x = game.world.get(entity, Position3Type, Float3.X);
    const y = game.world.get(entity, Position3Type, Float3.Y);
    const directionX = game.world.get(entity, Direction3Type, Float3.X);
    const directionY = game.world.get(entity, Direction3Type, Float3.Y);
    expect(x).toBeGreaterThan(0);
    expect(y).toBeGreaterThan(0);
    expect(game.world.get(entity, PreviousPosition3Type, Float3.X)).toBe(0);
    expect(directionX).toBeCloseTo(2 / Math.sqrt(5));
    expect(directionY).toBeCloseTo(1 / Math.sqrt(5));

    for (let tick = 0; tick < 40; tick++) game.update();
    expect(game.world.get(entity, Position3Type, Float3.X)).toBeCloseTo(2, 1);
    expect(game.world.get(entity, Position3Type, Float3.Y)).toBeCloseTo(1, 1);

    game.dispose();
});
