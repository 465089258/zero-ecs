import {
    QueryType,
    Update,
    With,
    defSystem,
    type DefinedSystem,
    type QueryOf,
    type Stage,
} from "@zero-ecs/game";
import {
    Aabb3,
    Float3,
    Position3Type,
} from "../3d/components";
import {
    ActiveCameraTag,
    CameraBasis3,
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
} from "./components";

/** 当前唯一活动正交相机及其派生缓存。 */
export const ActiveOrthographicCameraQuery = QueryType.from(With(
    Position3Type,
    TopDownCamera3Type,
    OrthographicCameraType,
    CameraBasis3Type,
    CameraWorldAabb3Type,
    ActiveCameraTag,
));

/** 需要由活动正交相机批量裁剪和投影的世界位置。 */
export const ProjectedPosition3Query = QueryType.from(With(
    Position3Type,
    ProjectionBounds3Type,
    Projected2Type,
));

type Cameras = QueryOf<typeof ActiveOrthographicCameraQuery>;
type Projectables = QueryOf<typeof ProjectedPosition3Query>;
type ProjectionSystem = DefinedSystem<[
    typeof ActiveOrthographicCameraQuery,
    typeof ProjectedPosition3Query,
]>;

/**
 * 默认在 Update.last 执行的正交相机裁剪与投影 System。
 *
 * 表现层使用自定义 ManualStage 时，改用 defineOrthographicProjectionSystem(stage)。
 */
export const orthographicProjectionSystem = defSystem(
    Update.last,
    projectOrthographicPositions,
    [ActiveOrthographicCameraQuery, ProjectedPosition3Query],
);

/**
 * 为宿主指定的阶段定义独立 Projection System。
 *
 * 函数和元数据只在构建冷路径创建；系统稳定执行期间不创建临时对象。
 */
export function defineOrthographicProjectionSystem(stage: Stage): ProjectionSystem {
    function runProjectionSystem(cameras: Cameras, projectables: Projectables): void {
        projectOrthographicPositions(cameras, projectables);
    }
    return defSystem(
        stage,
        runProjectionSystem,
        [ActiveOrthographicCameraQuery, ProjectedPosition3Query],
    );
}

/**
 * 更新活动相机派生数据，并批量执行 AABB 粗裁剪、正交视体精裁剪和 3D→2D 投影。
 *
 * 逐 Chunk 缓存所有字段列；逐实体循环只访问局部 TypedArray 和 number。
 */
export function projectOrthographicPositions(
    cameras: Cameras,
    projectables: Projectables,
): void {
    let cameraCount = 0;
    let cameraX = 0;
    let cameraY = 0;
    let cameraZ = 0;
    let rightX = 0;
    let rightY = 0;
    let rightZ = 0;
    let upX = 0;
    let upY = 0;
    let upZ = 0;
    let forwardX = 0;
    let forwardY = 0;
    let forwardZ = 0;
    let viewportCenterX = 0;
    let viewportCenterY = 0;
    let pixelsPerUnit = 0;
    let halfWidth = 0;
    let halfHeight = 0;
    let near = 0;
    let far = 0;
    let worldMinX = 0;
    let worldMinY = 0;
    let worldMinZ = 0;
    let worldMaxX = 0;
    let worldMaxY = 0;
    let worldMaxZ = 0;

    const cameraIter = cameras.iter();
    while (cameraIter.next()) {
        const [
            count,
            ,
            positions,
            orientations,
            settings,
            bases,
            worldBounds,
        ] = cameraIter.current;
        const positionXs = positions[Float3.X];
        const positionYs = positions[Float3.Y];
        const positionZs = positions[Float3.Z];
        const yaws = orientations[TopDownCamera3.Yaw];
        const elevations = orientations[TopDownCamera3.Elevation];
        const viewportWidths = settings[OrthographicCamera.ViewportWidth];
        const viewportHeights = settings[OrthographicCamera.ViewportHeight];
        const pixelScales = settings[OrthographicCamera.PixelsPerUnit];
        const nearDepths = settings[OrthographicCamera.Near];
        const farDepths = settings[OrthographicCamera.Far];
        const cullingMargins = settings[OrthographicCamera.CullingMargin];
        const basisRightXs = bases[CameraBasis3.RightX];
        const basisRightYs = bases[CameraBasis3.RightY];
        const basisRightZs = bases[CameraBasis3.RightZ];
        const basisUpXs = bases[CameraBasis3.UpX];
        const basisUpYs = bases[CameraBasis3.UpY];
        const basisUpZs = bases[CameraBasis3.UpZ];
        const basisForwardXs = bases[CameraBasis3.ForwardX];
        const basisForwardYs = bases[CameraBasis3.ForwardY];
        const basisForwardZs = bases[CameraBasis3.ForwardZ];
        const minimumXs = worldBounds[Aabb3.MinX];
        const minimumYs = worldBounds[Aabb3.MinY];
        const minimumZs = worldBounds[Aabb3.MinZ];
        const maximumXs = worldBounds[Aabb3.MaxX];
        const maximumYs = worldBounds[Aabb3.MaxY];
        const maximumZs = worldBounds[Aabb3.MaxZ];

        for (let row = 0; row < count; row++) {
            cameraCount++;
            if (cameraCount > 1) {
                throw new Error("Orthographic projection requires exactly one ActiveCameraTag");
            }

            cameraX = positionXs[row];
            cameraY = positionYs[row];
            cameraZ = positionZs[row];
            const yaw = yaws[row];
            const elevation = elevations[row];
            const viewportWidth = viewportWidths[row];
            const viewportHeight = viewportHeights[row];
            pixelsPerUnit = pixelScales[row];
            near = nearDepths[row];
            far = farDepths[row];
            const margin = cullingMargins[row];
            if (
                !Number.isFinite(cameraX) ||
                !Number.isFinite(cameraY) ||
                !Number.isFinite(cameraZ) ||
                !Number.isFinite(yaw) ||
                !Number.isFinite(elevation) ||
                elevation <= 0 ||
                elevation >= Math.PI * 0.5 ||
                !Number.isFinite(viewportWidth) ||
                viewportWidth <= 0 ||
                !Number.isFinite(viewportHeight) ||
                viewportHeight <= 0 ||
                !Number.isFinite(pixelsPerUnit) ||
                pixelsPerUnit <= 0 ||
                !Number.isFinite(near) ||
                !Number.isFinite(far) ||
                near < 0 ||
                far <= near ||
                !Number.isFinite(margin) ||
                margin < 0
            ) {
                throw new RangeError("Active orthographic camera has invalid parameters");
            }

            const sinYaw = Math.sin(yaw);
            const cosYaw = Math.cos(yaw);
            const sinElevation = Math.sin(elevation);
            const cosElevation = Math.cos(elevation);
            rightX = cosYaw;
            rightY = 0;
            rightZ = -sinYaw;
            upX = sinYaw * sinElevation;
            upY = cosElevation;
            upZ = cosYaw * sinElevation;
            forwardX = sinYaw * cosElevation;
            forwardY = -sinElevation;
            forwardZ = cosYaw * cosElevation;

            basisRightXs[row] = rightX;
            basisRightYs[row] = rightY;
            basisRightZs[row] = rightZ;
            basisUpXs[row] = upX;
            basisUpYs[row] = upY;
            basisUpZs[row] = upZ;
            basisForwardXs[row] = forwardX;
            basisForwardYs[row] = forwardY;
            basisForwardZs[row] = forwardZ;

            viewportCenterX = viewportWidth * 0.5;
            viewportCenterY = viewportHeight * 0.5;
            halfWidth = viewportCenterX / pixelsPerUnit + margin;
            halfHeight = viewportCenterY / pixelsPerUnit + margin;

            const halfDepth = (far - near) * 0.5;
            const centerDepth = (near + far) * 0.5;
            const centerX = cameraX + forwardX * centerDepth;
            const centerY = cameraY + forwardY * centerDepth;
            const centerZ = cameraZ + forwardZ * centerDepth;
            const extentX =
                Math.abs(rightX) * halfWidth +
                Math.abs(upX) * halfHeight +
                Math.abs(forwardX) * halfDepth;
            const extentY =
                Math.abs(rightY) * halfWidth +
                Math.abs(upY) * halfHeight +
                Math.abs(forwardY) * halfDepth;
            const extentZ =
                Math.abs(rightZ) * halfWidth +
                Math.abs(upZ) * halfHeight +
                Math.abs(forwardZ) * halfDepth;
            worldMinX = centerX - extentX;
            worldMinY = centerY - extentY;
            worldMinZ = centerZ - extentZ;
            worldMaxX = centerX + extentX;
            worldMaxY = centerY + extentY;
            worldMaxZ = centerZ + extentZ;
            minimumXs[row] = worldMinX;
            minimumYs[row] = worldMinY;
            minimumZs[row] = worldMinZ;
            maximumXs[row] = worldMaxX;
            maximumYs[row] = worldMaxY;
            maximumZs[row] = worldMaxZ;
        }
    }

    if (cameraCount === 0) {
        const projectableIter = projectables.iter();
        while (projectableIter.next()) {
            const [count, , , , projected] = projectableIter.current;
            const visible = projected[Projected2.Visible];
            for (let row = 0; row < count; row++) visible[row] = 0;
        }
        return;
    }

    const projectableIter = projectables.iter();
    while (projectableIter.next()) {
        const [count, , positions, bounds, projected] = projectableIter.current;
        const xs = positions[Float3.X];
        const ys = positions[Float3.Y];
        const zs = positions[Float3.Z];
        const radii = bounds[ProjectionBounds3.Radius];
        const projectedXs = projected[Projected2.X];
        const projectedYs = projected[Projected2.Y];
        const depths = projected[Projected2.Depth];
        const visible = projected[Projected2.Visible];

        for (let row = 0; row < count; row++) {
            const x = xs[row];
            const y = ys[row];
            const z = zs[row];
            const storedRadius = radii[row];
            const radius = storedRadius > 0 ? storedRadius : 0;

            if (
                x + radius < worldMinX ||
                y + radius < worldMinY ||
                z + radius < worldMinZ ||
                x - radius > worldMaxX ||
                y - radius > worldMaxY ||
                z - radius > worldMaxZ
            ) {
                visible[row] = 0;
                continue;
            }

            const dx = x - cameraX;
            const dy = y - cameraY;
            const dz = z - cameraZ;
            const viewX = dx * rightX + dy * rightY + dz * rightZ;
            const viewY = dx * upX + dy * upY + dz * upZ;
            const depth = dx * forwardX + dy * forwardY + dz * forwardZ;
            if (
                viewX + radius < -halfWidth ||
                viewX - radius > halfWidth ||
                viewY + radius < -halfHeight ||
                viewY - radius > halfHeight ||
                depth + radius < near ||
                depth - radius > far
            ) {
                visible[row] = 0;
                continue;
            }

            projectedXs[row] = viewportCenterX + viewX * pixelsPerUnit;
            projectedYs[row] = viewportCenterY - viewY * pixelsPerUnit;
            depths[row] = depth;
            visible[row] = 1;
        }
    }
}
