# 历史开发计划

> 本文是单包时期的历史迁移记录，不再描述当前目录和公共 API。当前事实以
> [architecture.md](./architecture.md) 与 [three-library-architecture.md](./three-library-architecture.md)
> 为准。

本文档记录旧单包迁移到纯数据 ECS 运行时的阶段性任务。

实施状态：阶段 0～13、15 已完成；阶段 14 的工程配置已完成，正式发布信息待项目所有者确认（2026-07-14）。2026-07-20 完成的 World 内核去 Service 化是后续架构决策，覆盖本文中 ComponentService、ArchetypeService、EntityService、QueryService、EcsMemoryService 与 CoreEcsModule 的历史计划描述。同日删除 InternalPost，新增公开 `Update.post`，Command、Migration、Event、Timer 改由系统依赖图排序；该决策覆盖阶段 2、7、9 中的历史阶段描述。当前事实以 [architecture.md](./architecture.md) 和 [game-world-architecture.md](./game-world-architecture.md) 为准。

## 1. 项目目标

下一版核心运行时应满足：

- ECS 只负责固定步长的纯数据模拟，不依赖 Pixi.js、Cocos、Laya 等表现层。
- `ecs.update()` 表示推进一个固定数据 Tick；真实时间累积、追帧和渲染插值由上层负责。
- Scheduler 保持确定性串行执行，近期不实现并行批次。
- EntityCommand 支持多个封闭 Service 在同一事务中动态组装实体。
- 所有延迟结构变更在 `Update.post` 统一提交，一个 Entity 每个提交周期最多迁移一次。
- 稳定容量下的核心路径不依赖 JIT 内联、逃逸分析或临时对象消除。
- Resource、State、Service 的类型名和职责保持确定、无歧义。

## 2. 已确认的设计决策

### 2.1 更新时序

删除 `Update.update`，标准生命周期调整为：

```text
Startup
→ Update.first
→ Update.fixed
→ Update.last
→ Update.post
→ Shutdown
```

`Update.post` 不内建功能分区。默认功能关系通过系统注册依赖图表达为：

```text
advanceTimersSystem
        ↓
flushCommandSystem
        ↓
flushEntityMigrationSystem
        ↓
flushEventsSystem
```

这些边只在相关 System 同时存在时建立；严格依赖使用 `before/after`，可选 Module
依赖使用 `beforeIfPresent/afterIfPresent`。无依赖的同阶段系统保持注册顺序。

### 2.2 严格类型命名

所有正式注入类型使用角色后缀：

| 类别 | 格式 | 示例 |
|---|---|---|
| Resource | `XxxResource` | `FixedTimeResource` |
| State | `XxxState` | `TimeState` |
| Service | `XxxService` | `CommandService` |
| Module | `XxxModule` | `CommandModule` |
| Component 定义 | `XxxType` | `PositionType` |

内部有限状态和缓存对象不得借用注入类型后缀，分别使用 `Flags`、`Phase`、`Plan`、`Record`、`Entry`、`Buffer` 等名称。

### 2.3 Command 与 EntityCommand

- 删除独立 `EntityCommands` Service。
- `EntityCommand` 成为普通 `Command` 子类，使用统一 Command 队列和对象池。
- `CommandService` 提供 `cmd()`、`entity()` 和 `spawn()`。
- `CommandService.spawn()` 立即预留 Entity ID，真正的组件创建和 Archetype 迁移延迟到 Post。
- EntityCommand 未提交时不自动取消或自动回收；调用方负责最终提交。
- Despawn 是 EntityCommand 的终止状态，之后任何 Add、Set、Remove 都必须报错。
- 删除 Bundle、BundlePool 和 BundlePoolItem；未来出现 Editor/Prefab 需求时重新设计独立模板能力。

### 2.4 Command 状态

Command 生命周期使用不公开的位标志：

```ts
const enum CommandFlags {
    Mutable = 0,
    Submitted = 1 << 0,
    Recycled = 1 << 1,
    LifecycleMask = Submitted | Recycled,
}
```

EntityCommand 使用扩展位：

```ts
const enum EntityCommandFlags {
    Despawn = 1 << 2,
    Structural = 1 << 3,
}
```

状态位只供 Command 内部和子类判断，不提供 public getter。生命周期固定为：

```text
Recycled → Mutable → Submitted → Recycled
```

### 2.5 无 JIT 约束

- 热路径使用索引循环，不依赖运行时消除 iterator、closure 或临时对象。
- 数组、Command、MigrationPlan 和写入记录按历史高水位复用。
- 不在热路径使用 rest、spread、`map`、`filter`、`reduce` 或每次调用创建的回调。
- TypeScript 构建阶段确定能够消除的语法不计入运行时模型。
- 性能测试用于验证，不作为判定代码是否零分配的唯一依据。

### 2.6 动态对象注入

- `InjectionService` 是唯一的动态对象注入入口，基础运行时自动注册。
- `World` 只访问 Resource、State、Service 三个容器，不再提供同义的 `inject()` API。
- `InjectionContext` 与 `injectAll()` 属于内部实现，不从稳定或 advanced 包入口导出。
- 注入不转移对象所有权，也不负责目标对象的 init、dispose 或池化。
- 同一对象在同一 Ecs 重复注入保持幂等；跨 Ecs 注入同一对象必须报错。
- 系统依赖仍通过参数元组显式声明，不应借助动态辅助对象隐藏 State 访问。

## 3. EntityCommand 事务语义

以下规则已经确认，是 EntityCommand、EntityMutator 和 EntityMigrationService 的统一行为契约。

### D1：Add/Remove 幂等性

```text
Add 已存在组件    → 无操作
Remove 不存在组件 → 无操作
Set 不存在组件    → 自动添加组件并设置值
```

Add 和 Remove 采用幂等语义，使多个封闭 Service 可以独立声明自身所需或不需要的组件，不必提前了解其他 Service 的组装结果。Set 对不存在组件执行隐式 Add，并将未设置字段保持为零。

因此 `Remove → Set` 等价于 `Remove → Add → Set`：原组件数据全部失效，先得到全零的新实例，再应用该 Set。

### D2：Remove 后重新 Add

`Remove → Add` 定义为创建新的组件实例，全部字段先清零，再应用 Remove 之后记录的 Set。即使最终 Mask 与初始 Mask 相同，也必须执行组件重置。

### D3：EntityMutator 组合边界

由最外层协调 Service 持有 EntityCommand，并把同一个、没有 `submit()`/`despawn()` 能力的 `EntityMutator` 类型视图传给下层组装 Service。该视图只是 TypeScript 接口，不创建运行时包装对象。

不同 EntityCommand 可以在 MigrationService 中合并，但不能同步读取彼此尚未执行的事务状态；需要 read-your-writes 的组装过程必须共享同一个 EntityCommand。

## 4. 目标运行数据流

```text
业务 System / SkillService
        ↓
CommandService.entity()/spawn()
        ↓
同一个 EntityCommand / EntityMutator
        ↓
多个 Service 执行 has/get/add/set/remove
        ↓
EntityCommand.submit()
        ↓
Post: flushCommandSystem
        ├─ 普通 Command 直接执行
        ├─ 纯 Set 且无 pending migration：直接写组件
        ├─ Add/Remove 或已有 pending migration：记录 MigrationPlan
        └─ Despawn：取消 MigrationPlan 后销毁 Entity
        ↓
Post: flushEntityMigrationSystem
        ↓
每个 Entity 最多一次迁移、重置和字段写入
        ↓
Post: flushEventsSystem
```

## 5. 目标代码组织

```text
src/
├─ context/
│  ├─ resource-container.ts
│  ├─ state-container.ts
│  ├─ service-container.ts
│  └─ world.ts
├─ ecs/
│  ├─ command/
│  │  ├─ command.ts
│  │  ├─ command-service.ts
│  │  ├─ entity-command.ts
│  │  ├─ command-module.ts
│  │  └─ systems.ts
│  ├─ migration/
│  │  ├─ entity-migration-service.ts
│  │  ├─ migration-plan.ts
│  │  └─ systems.ts
│  ├─ entity/
│  │  └─ entity-service.ts
│  ├─ archetype/
│  │  └─ archetype-service.ts
│  ├─ component/
│  │  └─ component-service.ts
│  └─ query/
│     └─ query-service.ts
├─ schedule/
│  ├─ stage.ts
│  └─ internal-stage.ts
└─ features/
   ├─ event/event-service.ts
   ├─ time/fixed-time-resource.ts
   ├─ time/time-state.ts
   ├─ timer/timer-service.ts
   └─ random/random-service.ts
```

实际迁移时可以保留现有目录粒度，但文件名和公开类型名必须符合统一规则。

## 6. 实施阶段

| 阶段 | 状态 | 完成日期 |
|---|---|---|
| 阶段 0：建立迁移基线 | 已完成 | 2026-07-14 |
| 阶段 1：严格命名迁移 | 已完成 | 2026-07-14 |
| 阶段 2：固定 Tick 与内部 Post | 已完成 | 2026-07-14 |
| 阶段 3：统一 Command 基础设施并删除 Bundle | 已完成 | 2026-07-14 |
| 阶段 4：EntityCommand 指令与局部事务 | 已完成 | 2026-07-14 |
| 阶段 5：EntityMigrationService | 已完成 | 2026-07-14 |
| 阶段 6：纯 Set 快速路径 | 已完成 | 2026-07-14 |
| 阶段 7：时间与可选功能重构 | 已完成 | 2026-07-14 |
| 阶段 8：无 JIT 静态审计 | 已完成 | 2026-07-14 |
| 阶段 9：公共边界与文档收口 | 已完成 | 2026-07-14 |
| 阶段 10：统一动态注入服务 | 代码完成，构建配置待确认 | 2026-07-14 |
| 阶段 11：生产正确性修复 | 已完成 | 2026-07-14 |
| 阶段 12：生命周期与异常安全 | 已完成 | 2026-07-14 |
| 阶段 13：公共 API 边界收紧 | 已完成 | 2026-07-14 |
| 阶段 14：多平台构建与发布配置 | 工程完成，发布信息待确认 | — |
| 阶段 15：质量与发布门禁 | 已完成 | 2026-07-14 |
| 阶段 16：全项目 GC 收口 | 已完成 | 2026-07-14 |

### 阶段 0：建立迁移基线

状态：已完成（2026-07-14）。

完成记录：

- 删除了根测试目录中与 `tests/schedule/scheduler.test.ts` 重复的 Scheduler 测试副本。
- README 已统一使用 `Write`，未保留旧的 `Mut()` 注册函数名称。
- 生命周期、Scheduler、QueryIter、EntityCommand 和公共声明构建均保留回归覆盖。
- 基线验证：8 个测试文件、22 个测试通过；`npm run build` 通过。

任务：

- 保存当前 `npm run test` 与 `npm run build` 通过状态。
- 删除重复的 Scheduler 测试文件，只保留目录结构正确的一份。
- 修正 README 中遗留的 `Mut` 命名。
- 为公开导出、生命周期顺序、QueryIter 和 EntityCommand 当前行为保留回归测试。
- 在计划实施期间禁止同时进行无关功能开发，减少重命名冲突。

验收：

- `npm run test` 和 `npm run build` 通过。
- 测试文件不存在仅导入路径不同的重复副本。
- 当前行为基线有明确测试覆盖。

### 阶段 1：严格命名迁移

状态：已完成（2026-07-14）。

完成记录：

- 完成计划内全部 Resource、State、Service、Module 重命名及文件迁移，未提供旧名称兼容别名。
- 为满足本阶段命名验收，待后续删除的旧实体命令服务先统一为 `EntityCommandService`，待阶段 7 拆分的时间服务先统一为 `TimeService`。
- `DirtyState` 已重命名为 `MigrationPlan`，相关缓存字段、日志和文档同步更新。
- 根导出、注入声明、系统参数、Module、测试、API 文档和架构图已同步新名称。
- 验证：8 个测试文件、22 个测试通过；`npm run build` 通过。

任务：

- `Commands` → `CommandService`。
- `Entities` → `EntityService`。
- `Events` → `EventService`。
- `Archetypes` → `ArchetypeService`。
- `Timer` → `TimerService`。
- `Randoms` → `RandomService`。
- `EcsMemory` → `EcsMemoryService`。
- `CommandsModule` → `CommandModule`。
- 保留已经符合规范的 `ComponentService`、`QueryService`。
- 同步修改文件名、注入装饰器、系统参数、Module 注册、测试、文档和根导出。
- 将内部 `DirtyState`、`CommandState` 等名称替换为 `MigrationPlan`、`CommandFlags` 等准确名称。

默认不保留旧名称兼容别名，避免同一能力出现两套公开语法。若需要兼容发布，必须另行决定弃用周期。

验收：

- 所有具体 Resource、State、Service、Module 类型符合命名规则。
- 根入口不再导出旧名称。
- 全部测试、声明文件和构建通过。

### 阶段 2：固定 Tick 与内部 Post（历史实现，已由 Update.post 取代）

状态：已完成（2026-07-14）。

完成记录：

- 删除 `Update.update`，公开阶段固定为 `first/fixed/last`，主逻辑与 Timer 推进迁移到 `fixed`。
- 新增不从公共 barrel 导出的 `InternalPost`，内部按 Command、Migration、Event 三个分区执行，以阶段顺序保证跨 Module 的提交次序。
- Command、EntityCommand 和 Event flush 已移出 `Update.last`；README、API 文档和架构图同步更新。
- 新增逆序注册 Module 的时序回归测试，并验证公共入口不导出 `InternalPost`。
- 验证：8 个测试文件、23 个测试通过；`npm run build` 通过。

任务：

- 从 `Update` 删除 `update` 阶段。
- `Update.stages` 公开部分只包含 `first/fixed/last`。
- 新建不从公共入口导出的内部 Post token。
- Ecs 内部按 `first/fixed/last/Post` 执行。
- 将主逻辑系统从 `Update.update` 迁移到 `Update.fixed`。
- 将 Command、Migration、Event 提交系统迁移到 Post。
- 通过包导出边界阻止普通业务代码取得 Post token。

验收：

- 业务代码只能注册 first/fixed/last。
- 一次 `ecs.update()` 严格执行一次固定 Tick。
- Post 始终在 last 后执行。
- Post 内 Command → Migration → Event 顺序有测试保证。

### 阶段 3：统一 Command 基础设施并删除 Bundle

状态：已完成（2026-07-14）。

完成记录：

- `Command`、`CommandService`、`EntityCommand` 已拆分为独立文件，普通命令与实体命令共用唯一队列和按类型对象池。
- 生命周期使用内部位标志；重复提交、提交后修改、回收后使用均报错，execute 或 clear 异常仍通过 finally 回收。
- Command 队列使用高水位数组与 used 游标，稳定容量下不为每次 flush 创建队列快照。
- `CommandService.entity()` 与 `spawn()` 已实现；spawn 在返回 EntityCommand 前立即预留有效 Entity ID。
- 删除 `EntityCommandService`、独立 flush 系统、Bundle、BundlePool、BundlePoolItem 及全部导出与文档。
- EntityCommand 未 submit 时保持有效且不自动取消；Despawn 后组件操作报错。
- 验证：8 个测试文件、25 个测试通过；`npm run build` 通过。

任务：

- 将 Command 基类、CommandService 和 EntityCommand 拆分到独立文件，避免循环依赖。
- 实现隐藏的 CommandFlags 和生命周期检查。
- submit 后禁止修改和重复提交；execute 异常时也必须在 finally 中回收。
- Command 队列和对象池使用高水位数组与 used 游标。
- CommandService 增加 `entity(entity)` 和 `spawn()`。
- `spawn()` 立即通过 EntityService 预留 Entity ID。
- EntityCommand 未 submit 不自动取消；文档说明调用方责任。
- 删除 EntityCommands Service、EntityCommandWriter、对应 flush 系统和 Module 注册。
- 删除 Bundle、BundlePool、BundlePoolItem 及其导出、测试和文档。

验收：

- 普通 Command 行为不因 EntityCommand 改变。
- Command 生命周期非法操作产生明确错误。
- `CommandService.spawn()` 返回可立即读取 Entity ID 的 EntityCommand。
- EntityCommand 和普通 Command 只由一个 CommandService 管理。
- 仓库不存在 Bundle 和 EntityCommands 的公开 API。

### 阶段 4：EntityCommand 指令与局部事务

状态：已完成（2026-07-14）。

完成记录：

- EntityCommand 使用固定四槽编码的普通 `number[]` 指令流和 `_used` 游标，Add、Remove、Set 在稳定容量下覆盖历史空间。
- 删除按数组初始化的 Add 重载；Set 不存在组件时执行隐式 Add，Add/Remove 按确认规则幂等。
- Despawn 使用终止状态位并清空有效指令；Structural 位区分结构事务和纯字段写入。
- 本地 target mask、组件列表及反向指令读取实现 `has/get` 的 read-your-writes。
- `Remove → Add` 和 `Remove → Set` 均创建全零新组件实例，仅保留 Remove 后的 Set。
- `EntityMutator` 是 EntityCommand 的纯 TypeScript 能力视图，不创建包装对象；测试覆盖多个 Service 可共享的同一实例语义。
- 验证：8 个测试文件、29 个测试通过；`npm run build` 通过。

任务：

- 使用普通 `number[]` 保存 Add、Set、Remove 指令。
- 使用 `_used` 覆盖历史高水位；只在达到新高水位时 `push()`。
- 删除 `add(Type, valuesArray)`，初始化统一使用 `add(Type).set(...)`。
- Despawn 使用状态位，不写指令；设置后 `_used = 0`。
- 增加 Structural 位区分纯 Set 与结构命令。
- EntityCommand 保存 baseMask/targetMask，提供事务内 `has()` 和 `get()`。
- `has/get/remove` 不注册未知组件，`add` 才调用 ComponentService.def()。
- 实现已确认的 Add/Remove/Set 状态转换，包括 Set 不存在组件时的隐式 Add。
- 定义 EntityMutator 类型接口，并完成多 Service 共享同一事务的用例。
- 明确延迟提交契约：允许 TimerService 后续 submit，但等待期间 Command 不回池，Entity 可能失效，本地事务视图可能过时。

验收：

- 指令记录稳定容量下不创建每指令对象或参数数组。
- 多个 Service 可以在同一 EntityMutator 上读取并修改组装结果。
- Despawn 后所有组件操作报错。
- 所有操作组合语义都有表驱动测试。

### 阶段 5：EntityMigrationService

状态：已完成（2026-07-14）。

完成记录：

- 新增不从公共入口导出的 `EntityMigrationService` 与池化 `MigrationPlan`；当前使用分页 TypedArray 索引合并同周期事务。
- EntityCommand 执行时直接解释数字指令到计划，不保留 Command 引用，也不复制完整指令流。
- MigrationPlan 分别复用目标组件列表、重置组件列表和并行字段写入数组；同字段最后一次 Set 生效。
- 跨 Command 的 Add/Remove 会按计划当前状态重新应用幂等规则，Set 在计划中发现组件不存在时执行隐式 Add。
- Remove 清除此前字段写入；Remove 后 Add/Set 即使最终 Mask 不变也会显式清零。
- Despawn 在销毁实体前取消 pending plan；Migration Post flush 每个 Entity 最多调用一次 migrate，之后复用计划槽位。
- 验证：9 个测试文件、33 个测试通过；`npm run build` 通过。

任务：

- 新增内部 EntityMigrationService。
- 使用分页 TypedArray 的 `Entity → planIndex` 索引查找 MigrationPlan，Post 后按触达列表清零。
- MigrationPlan、组件类型列表、重置列表和字段写入列表按高水位复用。
- `record()` 在 EntityCommand.execute 期间直接解释指令并合并最终状态，不保留 Command 引用，也不复制第二份完整指令流。
- 同字段多次 Set 最后一次生效。
- Remove 清除该组件此前待写字段。
- 记录 Remove 后重新 Add 的组件重置，即使最终 Archetype 不变也显式清零。
- `cancel(entity)` 用于 Despawn 取消 pending plan。
- `flush()` 每个 Entity 最多调用一次迁移，并按“迁移/清零/写字段”顺序提交。

验收：

- 多条 EntityCommand 可以在 MigrationPlan 中按执行顺序合并。
- 一个 Entity 每个 Post 周期最多迁移一次。
- Add/Remove/Set 跨 Command 的结果与单 Command 组合一致。
- Despawn 会取消先前收集的迁移。
- flush 后所有 Plan 可在下一周期复用。

### 阶段 6：纯 Set 快速路径

状态：已完成（2026-07-14）。

完成记录：

- 无 Structural 位且目标 Entity 没有 pending MigrationPlan 时，EntityCommand 采用两遍式直接字段写入。
- 第一遍完整验证 Entity、ComponentId 和字段，第二遍才写值，非法命令不会产生部分提交。
- EntityService 新增按 ComponentId 验证和写字段的内部 API，不创建 ComponentColumns view 数组。
- 结构命令之后的纯 Set 合并进已有 MigrationPlan；纯 Set 先执行时，后续迁移从当前 Archetype 复制其新值。
- 验证覆盖纯 Set 零迁移、前后结构命令组合及全量验证失败；9 个测试文件、36 个测试通过，`npm run build` 通过。

任务：

- EntityCommand 无 Structural 位且 MigrationService 中无该 Entity 的 pending plan 时，采用直接字段写入。
- 直接写入前先完整验证 Entity、所有组件和所有字段，再进行第二遍写入，避免部分提交。
- 如果已有 pending migration，即使当前命令只有 Set，也必须合并到 MigrationPlan。
- 为 EntityService 增加按 ComponentId 直接定位并读写字段的内部 API，不创建 Component View 数组。

验收：

- 纯 Set 不调用 Archetype 迁移。
- “先结构命令、后纯 Set”会正确进入已有 MigrationPlan。
- “先纯 Set、后结构命令”迁移后保留仍存在组件的新值。
- 非法纯 Set 不产生部分字段修改。

### 阶段 7：时间与可选功能重构

状态：已完成（2026-07-14）。

完成记录：

- 删除可变 `TimeService`，新增不可变 `FixedTimeResource` 和纯状态 `TimeState(delta/elapsed/tick)`。
- TimeModule 在 first 使用 `Write(TimeState)` 精确推进一次固定 Tick；核心不读取 wall clock，也不再包含 timeScale。
- TimerService 读取 FixedTimeResource 与 TimeState，按整数 Tick 推进分层时间轮；TimerModule 在 fixed 运行。
- EventService 保持内部 Post 最后 flush，并补充递归 post 延迟到下一 Tick 的行为测试和 dispose 清理。
- Timer 延迟 EntityCommand 可在目标 Tick 提交；Timer dispose/取消不会自动提交、取消或回收调用方 Command。
- RandomService 相同 seed 的确定性序列、Timer、Event、Time 生命周期均已覆盖。
- 验证：10 个测试文件、42 个测试通过；`npm run build` 通过。

任务：

- 将可变 Time Service 拆成 `FixedTimeResource` 与 `TimeState`。
- first 阶段使用 `Write(TimeState)` 推进固定 delta、elapsed 和 tick。
- TimerService 读取 TimeState，在 fixed 阶段推进任务。
- EventService 只在内部 Post 最后 flush。
- RandomService、TimerService、EventService 补齐生命周期和行为测试。
- 明确 Timer 延迟提交 EntityCommand 的责任：Timer 取消或 Entity 失效时不提供自动 Command 回收。

验收：

- ECS 核心不读取 wall clock。
- 相同输入与 Tick 数产生相同 TimeState。
- Timer、Event 与 Command/Migration 的 Post 顺序确定。

### 阶段 8：无 JIT 静态审计与稳定容量优化

状态：已完成（2026-07-14）。

完成记录：

- Scheduler 使用 Stage token Map 直接定位，0～8 参数走固定调用分支；每 Tick 不再创建 find 回调或使用参数 spread。
- Ecs、QueryIter、Command、Migration、Timer、Event 稳定路径统一使用索引循环。
- DataSet/Archetype 增加 tableId/row 数字访问，纯 Set 不再创建 location 对象；阶段 16 进一步将结构迁移 DataRow/RemoveResult 数字化。
- Query rebuild 移除临时 Archetype view 和 closure；统一结构版本与跨 rebuild 深度缓存复用保留为独立优化边界。
- EntityCommand 不存在默认 Error stack/调试字符串；RandomService 移除 seed 闭包/tuple 和 weight reduce 回调。
- 新增 `docs/performance.md`，逐路径记录稳定分配、高水位扩容、结构变化分配和保留边界。
- 新增 `npm run test:no-jit`，Node `--jitless` 下验证 Command、Migration、纯 Set 与固定时间；普通测试和生产构建继续通过。

任务：

- 默认关闭生产 EntityCommand 调试 stack 和调试字符串生成。
- 审计 Scheduler 每 Tick 的 `find` 回调、阶段查找和参数调用路径。
- 审计 EntityService/DataSet 的 DataRow、RemoveResult、location 临时对象；单独评审是否使用数字编码位置。
- 审计 MigrationService Map；只有在它成为明确问题时再替换为分页 TypedArray 索引。
- 将 Query 的统一结构版本、rebuild 缓存复用和临时 Archetype view 移除列为独立优化任务。
- 为 Command、Migration、Query、DataSet 建立多运行时验证用例；测试结果只作为验证证据，不替代静态分配分析。

验收：

- 每个核心路径都有明确的“稳定运行分配”和“高水位扩容分配”说明。
- 不存在默认开启的每命令 Error stack。
- 无 JIT 环境中的正确性与普通环境一致。

### 阶段 9：公共边界与文档收口

状态：已完成（2026-07-14）。

完成记录：

- API 文档、架构图、README 和性能文档已同步最终代码；旧 Service 名称、旧阶段和已删除实体模板 API 不再出现在当前 API 文档。
- 根入口明确导出稳定 Runtime、Component/Entity/Query、Command、System 和可选 Module。
- 新增 `zero-ecs-lib/advanced` 子路径，承载 Allocator、DataSet、Mask、Archetype、容器与 DevProfiler。
- InternalPost 与 EntityMigrationService 不从任何 package export 暴露；运行时测试验证内部深层子路径返回 `ERR_PACKAGE_PATH_NOT_EXPORTED`。
- Rslib 改为 bundleless 构建，保留 index/advanced 源码导出边界，避免多入口 bundle 合并运行时导出。
- API 文档补齐 Resource、State、Service、World、Query、Command、EventArgs 和 Entity 的所有权与保存期限。
- 最终验证：10 个测试文件、42 个测试通过；生产构建、声明生成、`npm run test:no-jit` 和 `npm pack --dry-run` 通过。

任务：

- 更新 API 文档和架构图，使其只描述完成后的实际行为。
- README 示例使用 `Write`、`Update.fixed` 和新 Service 名称。
- 评审根入口与 advanced/internal 入口，避免从稳定入口导出 ComponentId、Mask、DataSet、Archetype 等底层实现。
- 为所有公共类型补齐生命周期、所有权和“是否允许长期保存”的说明。

验收：

- 文档示例全部通过类型检查。
- 当前 API 文档与代码不存在旧名称、Bundle、EntityCommands 或 `Update.update`。
- 公共入口不暴露内部 Post 和 EntityMigrationService 的实现细节。

### 阶段 10：统一动态注入服务

状态：代码与文档已完成，构建配置待确认（2026-07-14）。

完成记录：

- 新增基础运行时自动注册的 InjectionService，并从稳定入口导出。
- EcsBuilder 使用 InjectionService 完成所有 State 与 Service 的初始属性注入，不再直接调用 injectAll。
- 删除 World 实例上的 `world.inject(instance)`，CommandService 改为依赖 InjectionService；`@World.inject()` 属性装饰器继续用于声明 World 依赖。
- InjectionContext 和 injectAll 保持包内部实现，advanced 入口不再导出 InjectionContext。
- 使用 WeakMap 记录动态对象所属 InjectionService；同 Ecs 重复注入幂等，跨 Ecs 注入报错。
- 测试覆盖自动注册、依赖解析、同 Ecs 幂等、跨 Ecs 拒绝及 dispose 后拒绝注入。
- 验证：10 个测试文件、44 个测试通过；`rslib build --no-bundle` 与 Node `--jitless` 冒烟通过。当前工作区已有的 `bundle: true` 与 glob 入口 `./src/**` 冲突，标准 `npm run build` 需在保留 bundleless 边界或改造 bundled 多入口之间确认后处理。

任务：

- 将动态辅助对象注入从 World 分离为专用 Service。
- 明确注入服务与 InjectionContext 的绑定和释放顺序。
- 固定动态注入的对象所有权和跨 Ecs 行为。
- 同步 Command、公共入口、API 文档和架构关系。

验收：

- 项目不存在 `world.inject(instance)` 或其他同义动态注入入口；`@World.inject()` 只表示属性依赖声明。
- Command 首次分配通过 InjectionService 注入，池化复用不重复注入。
- InjectionService 不接管动态对象生命周期，Ecs dispose 后拒绝使用。
- 普通测试、与既定 bundleless 边界一致的生产构建和无 JIT 验证通过；标准构建配置冲突已确认处理方向。

### 阶段 11：生产正确性修复

状态：已完成（2026-07-14）。

完成记录：

- Entity 句柄生成统一执行 `>>> 0`，高位 index 与 Query 的 Uint32 Entity 表示保持一致。
- 12 位 generation 到达 4095 后永久退休 slot，不再回绕到旧句柄；`valid()` 明确拒绝零 generation。
- EntityCommand 的 Add 指令记录本地是否创建新实例；幂等 Add 不再遮蔽此前 Set，read-your-writes 与最终提交一致。
- EventArgs 增加 Mutable、Posted、Recycled 生命周期，重复 post、post 后修改和回收后修改均报错；Event flush 使用 finally 保证回池。
- RandomService 使用确定默认种子，修复权重选择边界偏差，并验证 seed、范围、空数组和权重输入。
- EntityService 与 ArchetypeService dispose 所有 DataSet，EcsMemoryService 最终 clear allocator；Ecs.dispose 后 Block/Buffer 统计归零。
- 验证：10 个测试文件、48 个测试通过；`tsc --strict`、`rslib build --no-bundle` 与 Node `--jitless` 冒烟通过。

验收：

- Entity 高位表示稳定，旧句柄不会因 generation 回绕重新有效。
- EntityMutator 的同步读取与最终迁移结果一致。
- EventArgs 不会因重复 post 被重复放入对象池。
- `[1, 1]` 权重池能够选择两个分支，未 seed 的 RandomService 也处于有效状态。
- Ecs.dispose 后 allocator 的 allocatedBuffers 和 blockCount 都为零。

### 阶段 12：生命周期与异常安全

状态：已完成（2026-07-14）。

完成记录：

- StateContainer 与 ServiceContainer 保存实际拓扑初始化顺序，并严格按其逆序 dispose。
- 单个 State/Service 的 dispose 抛错时继续释放其余实例，清空容器后再抛出第一个错误。
- 新增基础运行时自动注册的 ErrorHandlerService，Command、Event listener/clear 与 Timer task 的可恢复错误统一通过 source 和 target 上报。
- CommandService.dispose 回收所有已提交但未执行的 Command；EntityMigrationService.dispose 取消 pending plan。
- 业务 System 或内部阶段抛错时 `Ecs.update()` 自动执行 stop 并进入 Stopped，失败 Tick 不允许再次 update，也不会在下一 Tick 重放 pending Command。
- 验证覆盖逆依赖释放、dispose 错误后继续清理、统一 Command 错误上报和失败 Tick；50 个测试、严格类型检查、bundleless 构建与无 JIT 冒烟通过。

验收：

- 任意注册顺序下，依赖方都先于其依赖释放。
- dispose 局部失败不造成后续 Service、State 或 Core 内存跳过清理。
- 可恢复的延迟任务错误只有一个可配置出口。
- 失败 Tick 进入终止状态，未提交的结构事务不会被意外延后执行。

### 阶段 13：公共 API 边界收紧

状态：已完成（2026-07-14）。

完成记录：

- `ComponentService.def/get` 只返回不含 World-local ID/Mask 的 `ComponentDefinition`；底层 `ComponentMeta` 通过 advanced 的 `defineComponentMeta/getComponentMeta` 明确取得。
- `Ecs` 的容器和 Scheduler 改为内部所有权，构造入口只供 `EcsBuilder` 使用；稳定根入口不再导出 Scheduler、EntityCommand 构造器及底层系统定义类型。
- 内部 bind、flush、reset/recycle、Entity migration/raw index 等成员使用 `@internal` 配合 `stripInternal` 从声明文件移除；删除过时的 `IQuery` 与 `getCompRow`。
- EventService 的 Listener Map 改为私有，外部只能通过 `on/one/off` 修改监听关系。
- 普通 Resource/State 系统参数及 `Ecs/World.resource/state` 映射为 `Readonly<T>`；只有 `Write(StateType)` 返回可写 `Mut<T>`，Service 仍由自身 API 决定开放能力。
- 验证：10 个测试文件、50 个测试通过；严格类型检查、bundleless 声明构建、根/advanced 运行时边界和 Node `--jitless` 冒烟通过。

验收：

- 稳定入口无法直接构造 Ecs、Scheduler 或 EntityCommand，也不能取得容器和内部组件注册数据。
- 公开声明不暴露内部生命周期钩子和迁移原语。
- ComponentDefinition 与 ComponentMeta 的稳定/advanced 边界明确。
- 默认 Resource/State 系统参数在 TypeScript 中是只读的。

### 阶段 14：多平台构建与发布配置

状态：工程配置已完成；正式发布信息待确认。

完成记录：

- Rslib 恢复 bundleless 输出，保留 `zero-ecs-lib` 与 `zero-ecs-lib/advanced` 两个显式包入口，并生成逐文件 ESM 与声明文件。
- 输出语法从 Node 22 专用目标调整为 ES2015，避免把 Node 运行时假设带入 Pixi.js、Cocos、Laya 等宿主。
- package 标记 `sideEffects: false`，补充描述和检索关键字；`npm pack --dry-run` 已验证只发布 README、package.json 与 dist。
- 标准 `npm run build` 已替代临时 `rslib build --no-bundle` 命令并通过。

待项目所有者确认：

- 首个公开版本号及发布通道（stable、alpha 或 beta）。
- LICENSE、author 与 repository。许可证是法律授权，不能由实现阶段代替所有者选择。

在这些信息确认前，代码可以被本地打包和集成测试，但不应执行正式 npm publish。

### 阶段 15：质量与发布门禁

状态：已完成（2026-07-14）。

完成记录：

- `tsconfig.json` 启用 strict，并增加独立 `typecheck` 命令。
- 新增基于构建后声明的公共类型契约测试，覆盖组件字段完整性、ComponentDefinition 边界、Ecs 私有构造/所有权和 Resource/State 只读参数。
- 新增 package exports 运行时测试，确认 root 不泄漏 Scheduler、EntityCommand、DataSet、Mask 或内部 Post，并拒绝未导出的 deep import。
- 新增 Mask 确定性性质测试，跨多个 Uint32 word 对照 Set 模型验证 or/and/xor/andNot/has/not/compare/copy；同时修复长度重算、无效 bit 校验与 `toZero` 拼写。
- `Ecs` 构造函数增加运行时 construction token 校验，JavaScript 调用方也不能绕过 EcsBuilder 直接构建无效实例。
- 新增 Node 20/22 GitHub Actions 矩阵；`prepack` 绑定统一的 `verify:release` 门禁。
- 本地门禁通过：strict typecheck、bundleless 构建、Node `--jitless`、公共类型测试与包边界测试。

### 阶段 16：全项目 GC 收口

状态：已完成（2026-07-14）。

完成记录：

- DataRow 最终收敛为 U32 物理位置：每个 DataSet 使用自身 Table 容量作为编码步长，`0xFFFFFFFF` 保留为无效值，释放的 Table ID 可复用。句柄可无损保存到 Uint32Array，但只在相关结构未变化期间有效。DataSet.remove 返回数字状态，Entity/Archetype 迁移不再创建 location、RemoveResult、from/to 对象。
- EntityService 热路径移除 `{ arch, row }` locate 对象；公开诊断位置仍按需物化。
- Archetype.copyCommonTo 改为索引循环，避免 ES2015 无 JIT 环境中的迭代器临时值。
- Timer 时间轮槽直接保存池化 InnerTask，删除 LevelTask 与 pending/deferred 临时数组。
- Query rebuild 跨结构版本复用 entry、current 和组件列视图，并在 Entry 失活时清除存储引用。
- EntityMigrationService 使用分页 TypedArray 替换 Map；Post 后通过高水位触达列表清零。
- Command、MigrationPlan、Event 和 Timer 增加显式 trim；Listener.clear 主动断开 callback/context。
- 增加层级 Timer、池收缩和 Listener 重入清理回归测试；详细分配边界见 `docs/performance.md`。
- DataSet swap-remove 跳过保留的空尾表，EntityService 只在 Archetype 删除成功后回收句柄；新增跨 Table 批量 Despawn/立即复用回归测试。
- 发布门禁通过：12 个测试文件/57 个测试、生产构建、Node `--jitless`、公共类型与 package exports；打砖块示例类型检查和生产构建通过。

## 7. 关键测试矩阵

### Command 生命周期

- Recycled → Mutable → Submitted → Recycled。
- 重复 submit 报错。
- submit 后 add/set/remove 报错。
- execute 抛错后仍回池。
- flush 后保留引用属于非法使用契约。

### EntityCommand 事务

- spawn 立即返回有效 Entity ID。
- Add 已存在组件、Remove 不存在组件均为无操作。
- Set 不存在组件会自动添加组件并设置指定字段，其他字段为零。
- Add → Remove、Remove → Add、Remove → Set、Set → Remove、Remove → Add → Set。
- Remove → Add 会清零全部字段，只应用 Remove 之后记录的 Set。
- Despawn 清除指令，之后所有组件操作报错。
- has/get 能读取当前 Entity 与本事务的合成结果。
- 多个 Service 共享同一 EntityMutator 时具备 read-your-writes。

### Migration

- 多 Command 同 Entity 合并。
- 同字段最后一次 Set 生效。
- Remove 清除此前写入。
- Remove → Add 在相同 Archetype 中也会清零。
- Despawn 取消已有计划。
- 一个 Entity 一个 Post 周期最多迁移一次。

### 阶段

- first/fixed/last/Post 顺序。
- 普通业务入口无法获得 Post。
- Command/Migration/Event 提交顺序。
- Query 在业务阶段内看到稳定结构，下一 Tick 看到 Post 提交结果。

## 8. 风险与控制措施

| 风险 | 控制措施 |
|---|---|
| 大规模重命名造成遗漏 | 单独完成阶段 1，不与功能改造混合；使用全仓搜索和声明构建验证 |
| Post 被业务代码绕过 | 不从 public barrel/package exports 导出内部 token |
| spawn command 未提交 | 明确契约、保留调试诊断，不在当前阶段增加自动取消 |
| 延迟 Command 的 Entity 或本地视图过期 | submit/execute 时重新验证；推荐延迟创建而不是长期持有 |
| 多 Service 使用不同 Command 导致看不到 pending 数据 | 通过 EntityMutator 约定由外层协调者持有唯一事务 |
| 纯 Set 绕过 pending migration | 直接写入前必须检查 `MigrationService.has(entity)` |
| 最终 Mask 相同导致 Remove→Add 未重置 | MigrationPlan 单独保存 resetComponents |
| 结构迁移索引在不同引擎产生不可控分配 | 已使用分页 TypedArray 和触达列表，不依赖 Map 节点复用 |

## 9. 明确延期项

以下能力不进入本轮核心开发：

- Query 组件读写权限。
- 并行 Scheduler 和自动冲突批次。
- Editor、Prefab 和新的 EntityTemplate。
- Boolean 组件列。
- 表现层、渲染同步和插值系统。
- 异步 Module 生命周期。
- 未经独立评审的深层 Readonly 类型。

## 10. 每阶段完成规则

任何阶段只有同时满足以下条件才算完成：

1. 对应代码、测试和文档同时更新。
2. `npm run test` 全部通过。
3. `npm run build` 及声明文件生成通过。
4. 没有通过兼容别名保留两套含义相同的 API。
5. 热路径新增分配已在代码评审中明确标注为高水位扩容或不可避免分配。
6. 下一阶段依赖的行为已经由测试固定，而不是只存在于设计文档中。
