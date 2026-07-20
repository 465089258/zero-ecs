# @zero-ecs/world

纯 ECS 数据内核。它拥有 Entity、Component、Archetype、Table、Query 与
`EntityCommand`，不依赖 Game、Scheduler 或依赖注入。

```ts
import { Allocator, World } from "@zero-ecs/world";

const allocator = new Allocator();
const world = new World(allocator);
const entity = world.reserveEntity();
const command = world.createEntityCommand(entity);
world.applyEntityCommand(command);
```

诊断与底层存储能力位于 `@zero-ecs/world/advanced`；`game-bridge` 只供匹配版本的
`@zero-ecs/game` 使用。
