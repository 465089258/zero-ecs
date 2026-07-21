# @zero-ecs/world

纯 ECS 数据内核。它拥有 Entity、Component、Archetype、Table、Query 与
`EntityCommand`，不依赖 Game、Scheduler 或依赖注入。

```ts
import { Allocator, World } from "@zero-ecs/world";

const allocator = new Allocator();
const world = new World(allocator);
const entity = world.reserveEntity();
const ref = world.ref(entity); // 低频只读便利对象；不用于 Query 热循环
const command = world.createEntityCommand(entity);
world.applyEntityCommand(command);
```

组件中的实体引用应声明为 `Types.Entity`。它仍使用 `Uint32Array` 存储，但 Query、
`World.get()`、`EntityRef.get()` 和 EntityCommand 会在类型层返回或要求 `Entity`，上层无需
`as Entity`。普通无符号整数仍使用 `Types.U32`，空实体句柄使用 `INVALID_ENTITY`。

诊断与底层存储能力位于 `@zero-ecs/world/advanced`；`game-bridge` 只供匹配版本的
`@zero-ecs/game` 使用。
