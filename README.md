# zero-ecs-lib

Typed-array ECS runtime for TypeScript.

## Documentation

- [API reference](./docs/api.md)
- [Architecture and diagrams](./docs/architecture.md)
- [Game / World architecture proposal](./docs/game-world-architecture.md)
- [State, Service, System, and Resource guidelines](./docs/development-guidelines.md)
- [Development plan](./docs/development-plan.md)
- [Performance and allocation model](./docs/performance.md)

## Examples

- [Splitstorm Breakout](./examples/breakout/README.md) — fixed-Tick Canvas breakout with power-up ball splitting and a 10,000-ball stress mode.

## Usage

```ts
import { defSystem, EcsBuilder, Update, Write, type Mut } from "zero-ecs-lib";

const gameSystem = defSystem(Update.fixed, updateGame, [Write(GameState)]);

function updateGame(game: Mut<GameState>): void {
    // Update the game state.
}

const builder = new EcsBuilder();

builder.addSystem(gameSystem);

const ecs = builder.build();
ecs.init();
ecs.start();
ecs.update();
ecs.dispose();
```

## Source layout

- `storage/`: typed arrays, 2 MiB block allocator, 16 KiB chunks and DataSet.
- `context/`: peer World, Resource, State and Service types, injection and containers.
- `ecs/`: component, archetype, entity, query, command and ECS memory domains.
- `schedule/`: stages, system parameters, immutable schedules and Scheduler.
- `runtime/`: Ecs lifecycle, EcsBuilder and Module contract.
- `features/`: optional event, time, timer and random functionality.
- `internal/`: non-public reusable implementation helpers.
- `dev/`: development-only tooling.

Internal modules use direct file imports. Barrel files are reserved for module and public API boundaries.

Stable runtime APIs are exported from `zero-ecs-lib`. Low-level storage and diagnostics are available from `zero-ecs-lib/advanced`; internal Post and migration implementation are not exported.

The published ESM output targets ES2015 and is emitted bundleless so applications and game engines can tree-shake the stable and advanced entry points independently.

## Commands

- `npm run build`
- `npm run dev`
- `npm run test`
- `npm run typecheck`
- `npm run verify:release`
- `npm run test:watch`
