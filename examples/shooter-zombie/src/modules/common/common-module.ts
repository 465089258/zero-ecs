import type { GameBuilder, Module } from "@zero-ecs/game";
import { GameSessionState } from "./game-state";
import { GameConfigResource } from "./resources";

/** 只安装叶子领域模块共同依赖的稳定共享内核。 */
export class SharedKernelModule implements Module {
    constructor(readonly config = new GameConfigResource()) {}

    build(builder: GameBuilder): void {
        builder
            .addResource(GameConfigResource, this.config)
            .addState(GameSessionState);
    }
}
