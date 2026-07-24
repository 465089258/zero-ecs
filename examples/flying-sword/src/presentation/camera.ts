import type {
    ReadonlyVector3,
    Vector3Out,
} from "@zero-ecs/flying-sword";

/** 投影后的屏幕坐标和相机空间深度。 */
export interface ProjectedPoint {
    x: number;
    y: number;
    depth: number;
}

export interface TopDownCameraOptions {
    readonly viewportWidth: number;
    readonly viewportHeight: number;
    readonly zoom?: number;
    /** 相机视线与地面的夹角；0 为水平，PI/2 为垂直俯视。 */
    readonly elevation?: number;
    /** 绕世界 Y 轴旋转；0 表示相机位于角色 -Z 后方。 */
    readonly yaw?: number;
    readonly target?: ReadonlyVector3;
}

/**
 * 面向 X=左右、Y=高度、Z=前后的正交斜俯视相机。
 *
 * 投影和 depth 始终来自同一组相机基向量。
 */
export class TopDownOrthographicCamera {
    private targetX = 0;
    private targetY = 0;
    private targetZ = 0;
    private centerX = 0;
    private centerY = 0;
    private zoomValue = 1;
    private elevationValue = degreesToRadians(50);
    private yawValue = 0;

    private rightX = 1;
    private rightZ = 0;
    private upX = 0;
    private upY = Math.cos(this.elevationValue);
    private upZ = Math.sin(this.elevationValue);
    private forwardX = 0;
    private forwardY = -Math.sin(this.elevationValue);
    private forwardZ = Math.cos(this.elevationValue);

    constructor(options: TopDownCameraOptions) {
        this.setViewport(options.viewportWidth, options.viewportHeight);
        this.setZoom(options.zoom ?? 1);
        this.setOrientation(
            options.elevation ?? degreesToRadians(50),
            options.yaw ?? 0,
        );
        if (options.target) this.setTarget(options.target);
    }

    get elevation(): number { return this.elevationValue; }
    get yaw(): number { return this.yawValue; }
    get zoom(): number { return this.zoomValue; }

    setViewport(width: number, height: number): void {
        positive("viewportWidth", width);
        positive("viewportHeight", height);
        this.centerX = width * 0.5;
        this.centerY = height * 0.5;
    }

    setZoom(zoom: number): void {
        this.zoomValue = positive("zoom", zoom);
    }

    setTarget(target: ReadonlyVector3): void {
        this.targetX = finite("target.x", target.x);
        this.targetY = finite("target.y", target.y);
        this.targetZ = finite("target.z", target.z);
    }

    setOrientation(elevation: number, yaw: number): void {
        finite("elevation", elevation);
        finite("yaw", yaw);
        if (elevation <= 0 || elevation >= Math.PI * 0.5) {
            throw new RangeError("elevation must be between 0 and PI / 2");
        }
        this.elevationValue = elevation;
        this.yawValue = yaw;

        const sinYaw = Math.sin(yaw);
        const cosYaw = Math.cos(yaw);
        const sinElevation = Math.sin(elevation);
        const cosElevation = Math.cos(elevation);
        this.rightX = cosYaw;
        this.rightZ = -sinYaw;
        this.upX = sinYaw * sinElevation;
        this.upY = cosElevation;
        this.upZ = cosYaw * sinElevation;
        this.forwardX = sinYaw * cosElevation;
        this.forwardY = -sinElevation;
        this.forwardZ = cosYaw * cosElevation;
    }

    project(x: number, y: number, z: number, out: ProjectedPoint): ProjectedPoint {
        const dx = x - this.targetX;
        const dy = y - this.targetY;
        const dz = z - this.targetZ;
        out.x = this.centerX + (dx * this.rightX + dz * this.rightZ) * this.zoomValue;
        out.y = this.centerY -
            (dx * this.upX + dy * this.upY + dz * this.upZ) * this.zoomValue;
        out.depth =
            dx * this.forwardX + dy * this.forwardY + dz * this.forwardZ;
        return out;
    }

    projectInterpolated(
        previousX: number,
        previousY: number,
        previousZ: number,
        x: number,
        y: number,
        z: number,
        alpha: number,
        out: ProjectedPoint,
    ): ProjectedPoint {
        const interpolation = Math.max(0, Math.min(1, alpha));
        return this.project(
            previousX + (x - previousX) * interpolation,
            previousY + (y - previousY) * interpolation,
            previousZ + (z - previousZ) * interpolation,
            out,
        );
    }

    /** 返回位于目标后上方、沿视线反方向 distance 处的相机位置。 */
    cameraPosition(distance: number, out: Vector3Out): Vector3Out {
        positive("distance", distance);
        out.x = this.targetX - this.forwardX * distance;
        out.y = this.targetY - this.forwardY * distance;
        out.z = this.targetZ - this.forwardZ * distance;
        return out;
    }

    /** 将屏幕点沿正交相机射线反投影到指定世界高度平面。 */
    unprojectToHeight(
        screenX: number,
        screenY: number,
        worldY: number,
        out: Vector3Out,
    ): boolean {
        const viewX = (screenX - this.centerX) / this.zoomValue;
        const viewY = -(screenY - this.centerY) / this.zoomValue;
        const originX = this.targetX + this.rightX * viewX + this.upX * viewY;
        const originY = this.targetY + this.upY * viewY;
        const originZ = this.targetZ + this.rightZ * viewX + this.upZ * viewY;
        if (Math.abs(this.forwardY) < 1e-8) return false;
        const distance = (worldY - originY) / this.forwardY;
        out.x = originX + this.forwardX * distance;
        out.y = worldY;
        out.z = originZ + this.forwardZ * distance;
        return true;
    }
}

export function degreesToRadians(degrees: number): number {
    return degrees * Math.PI / 180;
}

function finite(name: string, value: number): number {
    if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
    return value;
}

function positive(name: string, value: number): number {
    if (!Number.isFinite(value) || value <= 0) {
        throw new RangeError(`${name} must be a finite positive number`);
    }
    return value;
}
