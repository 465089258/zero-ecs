import { Service, type Entity } from "@zero-ecs/game";
import type { Vector3Out } from "./types";

/**
 * 飞剑库读取宿主空间数据的最小适配接口。
 *
 * 实现必须写入调用方提供的 out，热路径中不应创建临时坐标对象。
 */
export abstract class FlyingSwordSpatialService extends Service {
    abstract readPosition(entity: Entity, out: Vector3Out): boolean;
}
