# Zero ECS

Zero ECS 是一个面向游戏数据层的 TypeScript ECS workspace，由三个可独立安装的库组成：

- `@zero-ecs/world`：实体、组件、Archetype、Table、Query 与单实体事务；
- `@zero-ecs/scheduler`：不知道 ECS 的通用静态调度器；
- `@zero-ecs/game`：组合 World、Scheduler、依赖注入、生命周期与标准功能模块。

依赖方向固定为 `game -> world + scheduler`，World 与 Scheduler 之间互不依赖。

## 快速开始

```ts
import {
    Commands,
    DefaultCoreModule,
    GameBuilder,
    Types,
    type Component,
} from "@zero-ecs/game";

const enum Position { x, y }
class PositionType implements Component<Position> {
    readonly [Position.x] = Types.F32;
    readonly [Position.y] = Types.F32;
}

const game = new GameBuilder()
    .addModule(new DefaultCoreModule())
    .build();
game.init();
game.start();

const commands = game.service(Commands);
const command = commands.spawn()
    .set(PositionType, Position.x, 10)
    .set(PositionType, Position.y, 20);
const entity = command.entity;
command.submit();
game.update();

console.log(game.world.get(entity, PositionType, Position.x)); // 10
game.dispose();
```

`DefaultCoreModule` 一次安装 Commands、Time、Timer、Event 与 Random。需要减小运行时组成时，
仍可只注册 `CommandModule`、`TimeModule` 等独立模块。

World 也可以完全脱离 Game 使用：

```ts
import { Allocator, World } from "@zero-ecs/world";

const allocator = new Allocator();
const world = new World(allocator);
const entity = world.spawn();
world.valid(entity);
world.despawn(entity);
world.dispose();
allocator.clear();
```

## 开发命令

- `npm run typecheck`：分别检查三个包；
- `npm test`：运行源码行为测试；
- `npm run build`：按 world → scheduler → game 生成三个包；
- `npm run verify:release`：运行类型、行为、声明、包边界、no-JIT 与示例验证。

长期职责与评审准则见 [架构宪法](./docs/architecture-constitution.md)，当前实现见
[三库架构](./docs/three-library-architecture.md)，公共 API 见 [API 参考](./docs/api.md)。
