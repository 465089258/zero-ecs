import {
    CommandModule,
    CommandService,
    EcsBuilder,
    EntityService,
    FixedTimeResource,
    TimeModule,
    TimeState,
    Types,
} from "../dist/index.js";
import { Allocator, DataSet } from "../dist/advanced.js";

class PositionType {
    [0] = Types.F32;
    [1] = Types.F32;
}

if (typeof Allocator !== "function" || typeof DataSet !== "function") {
    throw new Error("advanced entry failed");
}

const ecs = new EcsBuilder()
    .addModule(new CommandModule())
    .addModule(new TimeModule(new FixedTimeResource(0.125)))
    .build();
ecs.init();
ecs.start();

const commands = ecs.service(CommandService);
const entities = ecs.service(EntityService);
const create = commands.spawn();
const entity = create.entity;
create.set(PositionType, 0, 4).set(PositionType, 1, 8).submit();
ecs.update();

if (entities.get(entity, PositionType, 0) !== 4) throw new Error("no-JIT structural write failed");
commands.entity(entity).set(PositionType, 0, 12).submit();
ecs.update();
if (entities.get(entity, PositionType, 0) !== 12) throw new Error("no-JIT direct Set failed");
if (ecs.state(TimeState).tick !== 2 || ecs.state(TimeState).elapsed !== 0.25) {
    throw new Error("no-JIT fixed time failed");
}

ecs.dispose();
