import type { GameBuilder } from "./game-builder";
import type { Game } from "./game";

/**
 * ECS 功能组合单元。
 * `build` 用于注册依赖，其余钩子用于管理容器外部资源。
 */
export interface Module {
    /** 向 Builder 注册 Resource、State、Service 和系统。 */
    build(builder: GameBuilder): void;
    /** Game 完成内部初始化后调用。 */
    init?(game: Game): void;
    /** Startup 系统执行后调用。 */
    start?(game: Game): void;
    /** Shutdown 系统执行前调用。 */
    stop?(game: Game): void;
    /** ECS 销毁过程中按注册逆序调用。 */
    dispose?(game: Game): void;
}
