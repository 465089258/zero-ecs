import type { EcsBuilder } from "./ecs-builder";
import type { Ecs } from "./ecs";

/**
 * ECS 功能组合单元。
 * `build` 用于注册依赖，其余钩子用于管理容器外部资源。
 */
export interface Module {
    /** 向 Builder 注册 Resource、State、Service 和系统。 */
    build(builder: EcsBuilder): void;
    /** ECS 完成内部初始化后调用。 */
    init?(ecs: Ecs): void;
    /** Startup 系统执行后调用。 */
    start?(ecs: Ecs): void;
    /** Shutdown 系统执行前调用。 */
    stop?(ecs: Ecs): void;
    /** ECS 销毁过程中按注册逆序调用。 */
    dispose?(ecs: Ecs): void;
}
