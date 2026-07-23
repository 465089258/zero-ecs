# @zero-ecs/world

纯 ECS 数据内核。它拥有 Entity、Component、Archetype、Table 与 Query，不依赖
Game、Scheduler、命令队列或依赖注入。

```ts
import { Allocator, World } from "@zero-ecs/world";

const allocator = new Allocator();
const world = new World(allocator);
const entity = world.spawn();
world.valid(entity);
world.despawn(entity);
```

组件中的实体引用应声明为 `Types.Entity`。它仍使用 `Uint32Array` 存储，但 Query、
`World.get/set()` 会在类型层返回或要求 `Entity`，上层无需 `as Entity`。普通无符号
整数仍使用 `Types.U32`，空实体句柄使用 `INVALID_ENTITY`。

`World.component/findComponent/componentById/resolve` 直接提供扩展所需的底层能力；
物理存储和诊断类型位于 `@zero-ecs/world/advanced`。
