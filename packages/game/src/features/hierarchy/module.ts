import type { GameBuilder } from "../../runtime/game-builder";
import type { Module } from "../../runtime/module";
import { HierarchyService } from "./hierarchy-service";
import { ChildOf, ParentOf } from "./relations";
import { ChildOfStorage, ParentOfStorage } from "./storage-components";

/**
 * 安装可选父子树能力。
 *
 * 依赖 CommandModule；模块自身不进入 DefaultCoreModule，也不改变独立 World 的语义。
 */
export class HierarchyModule implements Module {
    build(builder: GameBuilder): void {
        builder.addQueryProjection(ChildOf, ChildOfStorage);
        builder.addQueryProjection(ParentOf, ParentOfStorage);
        builder.setServiceFactory(
            HierarchyService,
            ({ worldAllocator }) => new HierarchyService(worldAllocator),
        );
    }
}

