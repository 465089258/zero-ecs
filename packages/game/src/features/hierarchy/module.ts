import type { GameBuilder } from "../../runtime/game-builder";
import type { Module } from "../../runtime/module";
import { HierarchyService } from "./hierarchy-service";

/**
 * 安装可选父子树能力。
 *
 * 依赖 CommandModule；模块自身不进入 DefaultCoreModule，也不改变独立 World 的语义。
 */
export class HierarchyModule implements Module {
    build(builder: GameBuilder): void {
        builder.setServiceFactory(
            HierarchyService,
            ({ worldAllocator }) => new HierarchyService(worldAllocator),
        );
    }
}
