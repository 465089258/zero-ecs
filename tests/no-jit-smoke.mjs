import {
    Commands,
    DefaultCoreModule,
    GameBuilder,
    Types,
} from "@zero-ecs/game";
import { Allocator, DataSet } from "@zero-ecs/game/advanced";
import { FixedTimeResource, TimeState } from "@zero-ecs/game/time";
import {
    Direction3Type,
    Float3,
    Position3Type,
    PreviousPosition3Type,
    Velocity3Type,
    normalizeFloat3,
} from "@zero-ecs/math/3d";
import {
    Motion3Module,
    MoveTowards3,
    MoveTowards3Type,
} from "@zero-ecs/motion/3d";
import {
    ActiveCameraTag,
    CameraBasis3Type,
    CameraWorldAabb3Type,
    OrthographicCamera,
    OrthographicCameraType,
    Projected2,
    Projected2Type,
    ProjectionBounds3,
    ProjectionBounds3Type,
    TopDownCamera3,
    TopDownCamera3Type,
    orthographicProjectionSystem,
} from "@zero-ecs/math/projection";

class PositionType {
    [0] = Types.F32;
    [1] = Types.F32;
}

if (typeof Allocator !== "function" || typeof DataSet !== "function") {
    throw new Error("advanced entry failed");
}

const builder = new GameBuilder()
    .addModule(new DefaultCoreModule(new FixedTimeResource(0.125)))
    .addModule(new Motion3Module());
builder.addSystem(orthographicProjectionSystem);
const game = builder.build();
game.init();
game.start();

const commands = game.service(Commands);
const entities = game.world;
const create = commands.spawn();
const entity = create.entity;
create.set(PositionType, 0, 4).set(PositionType, 1, 8);
create.submit();

commands.spawn()
    .add(Position3Type)
    .add(TopDownCamera3Type)
    .add(OrthographicCameraType)
    .add(CameraBasis3Type)
    .add(CameraWorldAabb3Type)
    .add(ActiveCameraTag)
    .set(Position3Type, Float3.X, 0)
    .set(Position3Type, Float3.Y, 10)
    .set(Position3Type, Float3.Z, -10)
    .set(TopDownCamera3Type, TopDownCamera3.Yaw, 0)
    .set(TopDownCamera3Type, TopDownCamera3.Elevation, Math.PI * 0.25)
    .set(OrthographicCameraType, OrthographicCamera.ViewportWidth, 100)
    .set(OrthographicCameraType, OrthographicCamera.ViewportHeight, 100)
    .set(OrthographicCameraType, OrthographicCamera.PixelsPerUnit, 10)
    .set(OrthographicCameraType, OrthographicCamera.Near, 0)
    .set(OrthographicCameraType, OrthographicCamera.Far, 30)
    .set(OrthographicCameraType, OrthographicCamera.CullingMargin, 0)
    .submit();
const projectable = commands.spawn();
const projectableEntity = projectable.entity;
projectable
    .add(Position3Type)
    .add(ProjectionBounds3Type)
    .add(Projected2Type)
    .set(Position3Type, Float3.X, 0)
    .set(Position3Type, Float3.Y, 0)
    .set(Position3Type, Float3.Z, 0)
    .set(ProjectionBounds3Type, ProjectionBounds3.Radius, 0.25)
    .submit();
const moving = commands.spawn();
const movingEntity = moving.entity;
moving
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
    .set(Direction3Type, Float3.X, 1)
    .set(Direction3Type, Float3.Y, 0)
    .set(Direction3Type, Float3.Z, 0)
    .set(MoveTowards3Type, MoveTowards3.TargetX, 1)
    .set(MoveTowards3Type, MoveTowards3.TargetY, 0)
    .set(MoveTowards3Type, MoveTowards3.TargetZ, 0)
    .set(MoveTowards3Type, MoveTowards3.MaximumSpeed, 2)
    .set(MoveTowards3Type, MoveTowards3.Acceleration, 20)
    .set(MoveTowards3Type, MoveTowards3.ArrivalRadius, 0.01)
    .submit();
game.update();

if (entities.get(entity, PositionType, 0) !== 4) throw new Error("no-JIT structural write failed");
const update = commands.entity(entity).set(PositionType, 0, 12);
update.submit();
game.update();
if (entities.get(entity, PositionType, 0) !== 12) throw new Error("no-JIT direct Set failed");
if (game.state(TimeState).tick !== 2 || game.state(TimeState).elapsed !== 0.25) {
    throw new Error("no-JIT fixed time failed");
}
if (entities.get(projectableEntity, Projected2Type, Projected2.Visible) !== 1) {
    throw new Error("no-JIT ECS projection failed");
}
if (entities.get(movingEntity, Position3Type, Float3.X) <= 0) {
    throw new Error("no-JIT ECS motion failed");
}

const vector = [
    new Float32Array([3]),
    new Float32Array([4]),
    new Float32Array([0]),
];
if (normalizeFloat3(vector, 0, vector, 0) !== 5) {
    throw new Error("no-JIT ECS math failed");
}
if (Math.abs(vector[Float3.X][0] - 0.6) > 1e-5) {
    throw new Error("no-JIT ECS math output failed");
}

game.dispose();
