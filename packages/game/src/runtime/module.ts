import type { GameBuilder } from "./game-builder";

/**
 * ECS 功能组合单元。
 * Module 只负责在构建期注册 Resource、State、Service 和 System，
 * 不作为 Game 持有的运行时对象。
 */
export interface Module {
    /** 向 Builder 注册 Resource、State、Service 和系统。 */
    build(builder: GameBuilder): void;
}
