import {
    expect,
    test,
} from "@rstest/core";
import {
    CommandModule,
    Commands,
    GameBuilder,
    Types,
} from "@zero-ecs/game";
import {
    Angle,
    Float2,
    Float3x3,
    Position2Type,
    composeMatrix3,
    lerpAngle,
    normalizeFloat2,
    transformPoint2,
    type Float2Columns,
    type Float3x3Columns,
} from "@zero-ecs/math/2d";
import {
    Aabb3,
    Float3,
    Float4,
    Float4x4,
    Position3Type,
    Rotation3Type,
    Sphere3,
    addFloat3,
    composeMatrix4,
    crossFloat3,
    identityQuaternion,
    intersectsSphereAabb3,
    normalizeFloat3,
    quaternionFromAxisAngle,
    rotateFloat3ByQuaternion,
    transformPoint3,
    type Aabb3Columns,
    type Float3Columns,
    type Float4Columns,
    type Float4x4Columns,
    type Sphere3Columns,
} from "@zero-ecs/math/3d";
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

test("math component field enums map to consecutive F32 layouts", () => {
    const game = new GameBuilder().build();
    expect(game.world.component(Position2Type).layout).toEqual([
        Types.F32,
        Types.F32,
    ]);
    expect(game.world.component(Position3Type).layout).toEqual([
        Types.F32,
        Types.F32,
        Types.F32,
    ]);
    expect(game.world.component(Rotation3Type).layout).toEqual([
        Types.F32,
        Types.F32,
        Types.F32,
        Types.F32,
    ]);
    expect(Float2.X).toBe(0);
    expect(Float2.Y).toBe(1);
    expect(Float3.X).toBe(0);
    expect(Float3.Z).toBe(2);
    expect(Angle.Radians).toBe(0);
    game.dispose();
});

test("vector operations reuse ECS columns and support in-place output", () => {
    const left = float3Columns();
    const right = float3Columns();
    set3(left, 3, 0, 0);
    set3(right, 0, 4, 0);

    addFloat3(left, 0, right, 0, left, 0);
    expect(read3(left)).toEqual([3, 4, 0]);
    expect(normalizeFloat3(left, 0, left, 0)).toBe(5);
    expect(left[Float3.X][0]).toBeCloseTo(0.6);
    expect(left[Float3.Y][0]).toBeCloseTo(0.8);

    set3(left, 1, 0, 0);
    set3(right, 0, 1, 0);
    crossFloat3(left, 0, right, 0, left, 0);
    expect(read3(left)).toEqual([0, 0, 1]);

    const vector2 = float2Columns();
    vector2[Float2.X][0] = 0;
    vector2[Float2.Y][0] = 0;
    expect(normalizeFloat2(vector2, 0, vector2, 0)).toBe(0);
    expect(vector2[Float2.X][0]).toBe(0);
    expect(vector2[Float2.Y][0]).toBe(0);
});

test("angle interpolation follows the shortest circular arc", () => {
    const from = 350 * Math.PI / 180;
    const to = 10 * Math.PI / 180;
    const middle = lerpAngle(from, to, 0.5);
    expect(middle).toBeCloseTo(0, 6);
});

test("2D and 3D transform operations write caller-owned matrix columns", () => {
    const position2 = float2Columns();
    const scale2 = float2Columns();
    const point2 = float2Columns();
    const matrix3 = matrix3Columns();
    set2(position2, 4, 5);
    set2(scale2, 2, 3);
    set2(point2, 1, 1);
    composeMatrix3(position2, 0, Math.PI * 0.5, scale2, 0, matrix3, 0);
    transformPoint2(matrix3, 0, point2, 0, point2, 0);
    expect(point2[Float2.X][0]).toBeCloseTo(1);
    expect(point2[Float2.Y][0]).toBeCloseTo(7);

    const position3 = float3Columns();
    const scale3 = float3Columns();
    const point3 = float3Columns();
    const rotation = float4Columns();
    const matrix4 = matrix4Columns();
    set3(position3, 2, 3, 4);
    set3(scale3, 1, 1, 1);
    set3(point3, 1, 0, 0);
    identityQuaternion(rotation, 0);
    composeMatrix4(
        position3,
        0,
        rotation,
        0,
        scale3,
        0,
        matrix4,
        0,
    );
    transformPoint3(matrix4, 0, point3, 0, point3, 0);
    expect(read3(point3)).toEqual([3, 3, 4]);
});

test("quaternion and geometry operations avoid temporary result objects", () => {
    const axis = float3Columns();
    const vector = float3Columns();
    const rotation = float4Columns();
    set3(axis, 0, 1, 0);
    set3(vector, 1, 0, 0);
    quaternionFromAxisAngle(axis, 0, Math.PI * 0.5, rotation, 0);
    rotateFloat3ByQuaternion(rotation, 0, vector, 0, vector, 0);
    expect(vector[Float3.X][0]).toBeCloseTo(0, 5);
    expect(vector[Float3.Z][0]).toBeCloseTo(-1, 5);

    const aabb = aabb3Columns();
    aabb[Aabb3.MinX][0] = -1;
    aabb[Aabb3.MinY][0] = -1;
    aabb[Aabb3.MinZ][0] = -1;
    aabb[Aabb3.MaxX][0] = 1;
    aabb[Aabb3.MaxY][0] = 1;
    aabb[Aabb3.MaxZ][0] = 1;
    const sphere = sphere3Columns();
    sphere[Sphere3.CenterX][0] = 1.5;
    sphere[Sphere3.CenterY][0] = 0;
    sphere[Sphere3.CenterZ][0] = 0;
    sphere[Sphere3.Radius][0] = 0.5;
    expect(intersectsSphereAabb3(sphere, 0, aabb, 0)).toBe(true);
});

test("projection system keeps result components while culling outside entities", () => {
    const builder = new GameBuilder().addModule(new CommandModule());
    builder.addSystem(orthographicProjectionSystem);
    const game = builder.build();
    game.init();
    game.start();

    const commands = game.service(Commands);
    const camera = commands.spawn();
    const cameraEntity = camera.entity;
    camera
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

    const visible = commands.spawn();
    const visibleEntity = visible.entity;
    visible
        .add(Position3Type)
        .add(ProjectionBounds3Type)
        .add(Projected2Type)
        .set(Position3Type, Float3.X, 0)
        .set(Position3Type, Float3.Y, 0)
        .set(Position3Type, Float3.Z, 0)
        .set(ProjectionBounds3Type, ProjectionBounds3.Radius, 0.25)
        .submit();

    const culled = commands.spawn();
    const culledEntity = culled.entity;
    culled
        .add(Position3Type)
        .add(ProjectionBounds3Type)
        .add(Projected2Type)
        .set(Position3Type, Float3.X, 20)
        .set(Position3Type, Float3.Y, 0)
        .set(Position3Type, Float3.Z, 0)
        .set(ProjectionBounds3Type, ProjectionBounds3.Radius, 0.25)
        .set(Projected2Type, Projected2.X, 777)
        .set(Projected2Type, Projected2.Visible, 1)
        .submit();

    // 首帧在 Update.post 提交结构，第二帧由 Update.last 批量投影。
    game.update();
    game.update();

    expect(game.world.get(visibleEntity, Projected2Type, Projected2.Visible)).toBe(1);
    expect(game.world.get(visibleEntity, Projected2Type, Projected2.X)).toBeCloseTo(50);
    expect(game.world.get(visibleEntity, Projected2Type, Projected2.Y)).toBeCloseTo(50);
    expect(game.world.get(visibleEntity, Projected2Type, Projected2.Depth))
        .toBeCloseTo(Math.sqrt(200));
    expect(game.world.get(culledEntity, Projected2Type, Projected2.Visible)).toBe(0);
    // 裁剪只更新可见标记；组件和最近一次有效投影数据都永久保留。
    expect(game.world.has(culledEntity, Projected2Type)).toBe(true);
    expect(game.world.get(culledEntity, Projected2Type, Projected2.X)).toBe(777);

    commands.entity(cameraEntity).remove(ActiveCameraTag).submit();
    game.update();
    game.update();
    expect(game.world.get(visibleEntity, Projected2Type, Projected2.Visible)).toBe(0);
    expect(game.world.has(visibleEntity, Projected2Type)).toBe(true);

    game.dispose();
});

function float2Columns(): Float2Columns {
    return {
        [Float2.X]: new Float32Array(1),
        [Float2.Y]: new Float32Array(1),
    };
}

function float3Columns(): Float3Columns {
    return {
        [Float3.X]: new Float32Array(1),
        [Float3.Y]: new Float32Array(1),
        [Float3.Z]: new Float32Array(1),
    };
}

function float4Columns(): Float4Columns {
    return {
        [Float4.X]: new Float32Array(1),
        [Float4.Y]: new Float32Array(1),
        [Float4.Z]: new Float32Array(1),
        [Float4.W]: new Float32Array(1),
    };
}

function matrix3Columns(): Float3x3Columns {
    return {
        [Float3x3.M00]: new Float32Array(1),
        [Float3x3.M01]: new Float32Array(1),
        [Float3x3.M02]: new Float32Array(1),
        [Float3x3.M10]: new Float32Array(1),
        [Float3x3.M11]: new Float32Array(1),
        [Float3x3.M12]: new Float32Array(1),
        [Float3x3.M20]: new Float32Array(1),
        [Float3x3.M21]: new Float32Array(1),
        [Float3x3.M22]: new Float32Array(1),
    };
}

function matrix4Columns(): Float4x4Columns {
    return {
        [Float4x4.M00]: new Float32Array(1),
        [Float4x4.M01]: new Float32Array(1),
        [Float4x4.M02]: new Float32Array(1),
        [Float4x4.M03]: new Float32Array(1),
        [Float4x4.M10]: new Float32Array(1),
        [Float4x4.M11]: new Float32Array(1),
        [Float4x4.M12]: new Float32Array(1),
        [Float4x4.M13]: new Float32Array(1),
        [Float4x4.M20]: new Float32Array(1),
        [Float4x4.M21]: new Float32Array(1),
        [Float4x4.M22]: new Float32Array(1),
        [Float4x4.M23]: new Float32Array(1),
        [Float4x4.M30]: new Float32Array(1),
        [Float4x4.M31]: new Float32Array(1),
        [Float4x4.M32]: new Float32Array(1),
        [Float4x4.M33]: new Float32Array(1),
    };
}

function aabb3Columns(): Aabb3Columns {
    return {
        [Aabb3.MinX]: new Float32Array(1),
        [Aabb3.MinY]: new Float32Array(1),
        [Aabb3.MinZ]: new Float32Array(1),
        [Aabb3.MaxX]: new Float32Array(1),
        [Aabb3.MaxY]: new Float32Array(1),
        [Aabb3.MaxZ]: new Float32Array(1),
    };
}

function sphere3Columns(): Sphere3Columns {
    return {
        [Sphere3.CenterX]: new Float32Array(1),
        [Sphere3.CenterY]: new Float32Array(1),
        [Sphere3.CenterZ]: new Float32Array(1),
        [Sphere3.Radius]: new Float32Array(1),
    };
}

function set2(columns: Float2Columns, x: number, y: number): void {
    columns[Float2.X][0] = x;
    columns[Float2.Y][0] = y;
}

function set3(columns: Float3Columns, x: number, y: number, z: number): void {
    columns[Float3.X][0] = x;
    columns[Float3.Y][0] = y;
    columns[Float3.Z][0] = z;
}

function read3(columns: Float3Columns): number[] {
    return [
        columns[Float3.X][0],
        columns[Float3.Y][0],
        columns[Float3.Z][0],
    ];
}
