import {
    Commands,
    DefaultCoreModule,
    FixedTimeResource,
    GameBuilder,
    TimeState,
    Types,
} from "@zero-ecs/game";
import { Allocator, DataSet } from "@zero-ecs/game/advanced";

class PositionType {
    [0] = Types.F32;
    [1] = Types.F32;
}

if (typeof Allocator !== "function" || typeof DataSet !== "function") {
    throw new Error("advanced entry failed");
}

const game = new GameBuilder()
    .addModule(new DefaultCoreModule(new FixedTimeResource(0.125)))
    .build();
game.init();
game.start();

const commands = game.service(Commands);
const entities = game.world;
const create = commands.spawn();
const entity = create.entity;
create.set(PositionType, 0, 4).set(PositionType, 1, 8);
create.submit();
game.update();

if (entities.get(entity, PositionType, 0) !== 4) throw new Error("no-JIT structural write failed");
const update = commands.entity(entity).set(PositionType, 0, 12);
update.submit();
game.update();
if (entities.get(entity, PositionType, 0) !== 12) throw new Error("no-JIT direct Set failed");
if (game.state(TimeState).tick !== 2 || game.state(TimeState).elapsed !== 0.25) {
    throw new Error("no-JIT fixed time failed");
}

game.dispose();
