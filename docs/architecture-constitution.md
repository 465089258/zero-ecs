# Zero ECS 架构宪法

> 状态：规范性设计文档。
>
> 本文规定 `@zero-ecs/world`、`@zero-ecs/scheduler` 和 `@zero-ecs/game` 的长期职责、
> 依赖方向与评审准则。它不描述某一次迁移的临时实现。其他文档与本文冲突时，应先修改
> 实现或明确修订本文，不能通过兼容层、桥接层或隐式依赖绕过边界。

## 1. 核心定位

### 1.1 `@zero-ecs/world`：机制（Mechanism）

`World` 是立即执行、数据导向、不附带业务安全策略的 ECS 数据内核。它负责：

- Entity 身份、版本和存储位置；
- Component 注册和 World-local 元数据；
- Archetype、Chunk、Table 和组件列；
- Query 匹配、列投影和迭代；
- 立即 `spawn/migrate/set/despawn`；
- 内核数据结构自身的释放与一致性。

World 不理解：

- 帧、Stage、System 或固定更新；
- Commands、事务、提交阶段或迁移合并；
- Resource、State、Service、Module 或依赖注入；
- Event、Timer、Hierarchy 等业务功能；
- 业务代码当前是否处于安全的结构修改时机。

World 只保证底层数据结构自身安全，不保证业务时序安全。调用方直接使用 World 的即时
结构 API 时，必须自行保证没有冲突的 Query 迭代、缓存位置或上层策略。

“World 不关心生命周期”特指它不理解 Game 生命周期。World 仍然拥有自己的存储生命周期，
并负责在 `dispose()` 时归还自己申请的 Buffer。

### 1.2 `@zero-ecs/scheduler`：拓扑（Topology）

Scheduler 是领域无关的静态执行拓扑。它负责：

- Stage 和 SystemSet；
- 不透明可调用单元；
- `before/after` 有向依赖；
- 稳定、确定的拓扑排序；
- 冷路径参数解析和运行快照；
- 按 Stage 串行执行已准备的系统。

Scheduler 不理解：

- World、Entity、Component、Archetype 或 Query；
- Resource、State、Service 或 Commands；
- Game 生命周期和业务阶段含义；
- 参数代表读访问、写访问还是其他副作用。

Scheduler 处理的是“不透明可调用单元”，而不是强制意义上的纯函数。System 是否修改状态、
发送命令或调用宿主能力，由组合 Scheduler 的上层决定。

### 1.3 `@zero-ecs/game`：策略（Policy）

Game 是面向业务的组合框架。它负责：

- 组合 World 和 Scheduler；
- Game 生命周期和标准 Stage；
- Resource、State、Service、Module 与依赖注入；
- System 参数到运行时对象的映射；
- Commands、EntityTransaction 和迁移合并；
- 延迟结构修改和安全提交边界；
- Event、Timer、Random、Hierarchy 等可选功能；
- 错误策略、对象池、调试和宿主集成。

普通业务应优先使用 Game 的 Service、System 参数和延迟 Commands。World 仍作为明确的
底层扩展入口开放；Game 不通过 `WorldView`、权限 wrapper 或运行时热检查强制封闭它。

## 2. 不可逆依赖方向

```text
@zero-ecs/world          @zero-ecs/scheduler
数据机制                  执行拓扑
          \              /
             @zero-ecs/game
              组合策略
```

依赖规则：

1. World 不依赖 Scheduler 或 Game。
2. Scheduler 不依赖 World 或 Game。
3. World 和 Scheduler 相互独立。
4. Game 可以依赖并组合 World 与 Scheduler。
5. 可选 Game Feature 只能依赖 Game 公共能力或包内实现，不能反向要求 World 理解 Feature。
6. 跨包共享运行时类型必须保持单份身份；Game 使用 peer dependency 组合 World 和 Scheduler。

禁止通过以下方式伪造反向依赖：

- 在 World 中增加 Game bridge、Command hook 或生命周期回调；
- 在 Scheduler 中识别 Query、State、Service 等领域 token；
- 以通用命名包装实际只服务 Game 的接口；
- 通过全局注册表或 prototype patch 让一个 Game 实例改变其他实例或独立 Scheduler。

## 3. 机制与策略的判定规则

新增能力先回答以下问题：

| 问题 | 归属 |
| --- | --- |
| 它描述数据如何存放、查找、移动或释放吗？ | World |
| 它描述可调用单元如何排序和执行吗？ | Scheduler |
| 它决定何时调用底层能力、如何保护业务时序吗？ | Game |
| 它依赖帧、模块、宿主、功能开关或业务语义吗？ | Game |
| 它只是为了让 Game 访问 World 私有状态吗？ | 先改进 World 的通用底层 API，禁止 bridge |
| 它要让 Scheduler 理解 ECS 参数吗？ | 访问元数据应由 Game 编译，再转换为领域无关约束 |

典型示例：

| 能力 | 正确归属 | 原因 |
| --- | --- | --- |
| `Archetype.setSpareChunkLimit(n)` | World | 提供内存保留机制 |
| 检测 Archetype 波动并选择 `n` | Game | 帧级自适应策略 |
| `World.migrate()` | World | 立即数据搬运原语 |
| 合并同一 Entity 的多条结构命令 | Game | 提交时序与事务策略 |
| 稳定 Kahn 拓扑排序 | Scheduler | 领域无关执行拓扑 |
| `Update.post`、Commands、Structure | Game | 业务阶段语义 |
| Query 匹配和 Chunk 列视图 | World | ECS 数据读取机制 |
| 为重复 Query 参数创建独立 Query | Game | System 参数使用策略 |
| Archetype 填充率统计 | Game DevTools | 诊断策略，不进入内核热路径 |

## 4. 立即修改与延迟修改

三库必须保留清晰的两条路径：

```text
底层扩展：
World API
  → 立即生效
  → 调用方负责时序安全

普通业务：
Game Commands
  → EntityTransaction
  → 按 Entity 合并
  → 安全提交阶段
  → World API
```

约束：

1. World 不提供 `add/remove` 组件事务，也不保存待提交状态。
2. World 不因为 Game 的安全需求增加每次访问的权限或阶段检查。
3. Game 不复制 World 的存储实现，只组合 World 提供的立即原语。
4. EntityTransaction 的 read-your-writes 只保证当前局部事务；除非另有明确设计，不能宣传为
   所有独立事务和 Query 都具备完整同帧可见性。
5. “每个 Entity 最多迁移一次”必须限定在一次 Migrations 收集与应用批次内。
6. 直接 World 修改不自动获得 Hierarchy、Event 或其他 Game Feature 的附加语义。

## 5. 热路径与冷路径

### 5.1 World

- 热路径优先连续 TypedArray、数字索引和调用者复用的输出对象。
- 已由上层或当前对象证明成立的不变量，不重复进行多层校验。
- 必需的底层边界校验保留在公开立即 API；Archetype 内部可信路径可以使用直接列访问。
- 结构增长允许分配，稳定工作集下的 Query 和字段循环不得依赖逐行临时对象。
- 诊断便利 API 可以分配，但必须在命名或文档中明确。

### 5.2 Scheduler

- DAG 构建、错误校验、参数解析和 runner 生成属于冷路径。
- `run()` 只保留阶段定位和紧凑顺序调用。
- 不为尚未使用的访问图、并行计划或错误包装增加生产热路径成本。

### 5.3 Game

- Commands、事务、事件和计时器可以在容量增长时扩容。
- 稳定高水位下应复用队列、事务、页和对象池。
- 自适应策略只观察本批次触达对象，不应每帧全量扫描 World。
- Profiler、日志和统计必须是显式开发能力，不能默认污染生产路径。

“零 GC”只描述工作集稳定后的特定热路径，不表示框架从启动到释放绝不分配。

## 6. 开放与安全

Game 的安全 API 是默认路径，World 是可选的底层扩展路径。二者不是权限隔离关系：

- 不新增 WorldView；
- 不隐藏 `game.world`；
- 不阻止高级用户直接导入 `@zero-ecs/world`；
- 不为防御故意误用而牺牲 World 热路径；
- 文档必须明确哪些引用会在结构变更后失效；
- Game 内建功能必须通过 Commands 等安全边界组合，而不是依赖调用方碰巧遵守顺序。

## 7. 当前边界审计

### 7.1 已经符合宪法，应保持

#### World

- World 与 Scheduler/Game 没有源码依赖。
- Entity slot、Archetype 集合和 Query 数据源由 World 直接持有。
- EntityCommand、EntityTransaction、Migrations 已从 World 删除。
- World 不再提供 Game bridge、WorldView 或 EntityRef。
- QueryProjection 在定义时绑定存储，不依赖 Game 注册链。
- ComponentRegistry 作为 World 私有实现对象保留，不形成 Service 或转发层。
- Allocator、DataSet、Table、Archetype 和 Query 都属于数据机制。

#### Scheduler

- Scheduler 只认识 Stage、SystemSet、System、依赖和不透明 Param。
- Game 定义 Startup、Update、Shutdown，不把阶段语义放进 Scheduler。
- 参数解析通过领域无关 `SystemParamProvider` 完成。

#### Game

- Game 使用 peer dependency 组合 World 和 Scheduler。
- Resource、State、Service、Module 和 DI 都留在 Game。
- EntityTransaction、分页 Entity→accumulator 索引和迁移合并位于 Game。
- 每个重复 QueryType 参数解析为独立 Query 实例。
- Event、Timer、Random、Hierarchy 和对象池属于 Game Feature/Service。
- `game.world` 保持开放的底层逃生口，没有重新引入 WorldView。

### 7.2 必须收紧或迁移

#### P0：完成 World 的局部 Chunk 版本模型

当前 World 仍维护全局 `layoutVersion`，任一 Archetype 的 Chunk 数变化都会让全部 Query
进入布局同步检查。应按已经确认的设计迁移为：

- `World.version` 只表达 Archetype 集合变化；
- `Archetype.version` 只表达自身物理 Chunk 集合变化；
- Query 只在进入匹配 Archetype 时比较对应 entry 的版本；
- 删除 World `_layoutVersion`、`onLayoutChange` 和 Query `_layoutVersion`。

这不是把策略上移到 Game，而是让 World 的数据机制具有正确的局部失效粒度。

#### P0：把固定空 Chunk 改为机制参数

当前 Archetype 使用硬编码 `RETAIN_EMPTY_CHUNKS = 1`。应改为：

- 每个 Archetype 拥有 `spareChunkLimit`，默认 `0`；
- 降低限制时立即释放超额连续尾 Chunk；
- 提高限制时不主动分配；
- World 只提供设置与回收机制；
- Game 将来可以根据迁移触达记录和波动情况选择保留数量。

具体设计以
[Archetype、Query 与 Chunk 生命周期收敛方案](./archetype-query-chunk-lifecycle-design.md)
为准。

#### P0：收紧 Commands 的提交控制面

`Commands` 是稳定业务 Service，但当前 `flush()`、pending 读取和扩展注册都是普通 public
方法。它们实际上属于 Game 内部提交协议。应收紧为：

- 稳定业务面只保留 `cmd/entity/spawn` 和明确允许的维护能力；
- `flush/collect/apply` 只能由内建提交 System 调用；
- pending 观察和 `CommandFlushExtension` 保持包内协议；
- 不允许业务 System 手动制造第二个提交边界；
- 不把这些方法迁移进 World。

可以通过包内非导出 token、同文件内建 System 或其他不增加运行时分支的方式实现，不需要
新增 Service facade。

#### P0：移除 DevProfiler 的全局 prototype patch

当前 DevProfiler 修改 `Scheduler.prototype.run`，会让一个 Game 的调试行为影响同进程中的
其他 Game 和独立 Scheduler。这违反实例隔离。应改为：

- 在 Game 自己的 Stage 执行边界采样；
- 或由 GameBuilder 显式安装仅属于该 Game 的执行观察器；
- 不在 Scheduler 中加入默认生产分支；
- 不全局修改 Scheduler prototype；
- 同时补充 Archetype/Chunk 填充率、逻辑/物理 Chunk 和 spare Chunk 统计。

#### P1：清理 Scheduler 的无效 Builder 标识

当前 `ScheduleBuilder` 保存 `_builderId`，句柄也写入未声明的 `__builderId`，但实际校验已经
通过 `id + 对象身份` 完成。该字段没有提供额外保护，应删除全局 builder 计数、字段和隐藏
句柄属性，保留对象身份校验。

#### P1：编译 Scheduler runner

将参数数量分支从 `run()` 移到 `prepare()` 是符合冷热分离原则的内部优化，但必须：

- 以目标平台基准决定是否采用；
- 保留当前 0～8 参数专用路径；
- 避免 `systems[i].runner()` 改变 0 参数普通函数的 `this`；
- 优先让 RuntimeStage 直接保存 runner 数组；
- 不宣称“零数组索引”或“无 Map”，只说明消除了参数数组读取与每次参数数量分支。

#### P1：补全 Scheduler 冷路径诊断

- 严格 `before/after` 遇到空 SystemSet 时应报错；
- `beforeIfPresent/afterIfPresent` 遇到空集合时保持 no-op；
- Kahn 失败后提取真实环路，不把全部未输出节点伪装成一条环；
- `RuntimeSystem`、`RuntimeStage` 若没有外部使用价值，应从稳定导出中收回为内部类型。

#### P1：收紧 Game 根入口

当前 Game 根入口同时 `export *` 多个可选 Feature，而这些 Feature 已有独立子路径。发布前应
审查并固定：

- 根入口只保留核心组合 API 和真正高频的公共声明；
- Event、Timer、Random、Hierarchy、Pool 优先从各自子路径导出；
- 内部 State、池实现、提交 System 和存储对象不得进入根入口；
- `@zero-ecs/game/advanced` 可以保持不稳定，但不应成为绕过包所有权的默认入口。

Game 从 World 重导出常用组件、Query DSL 和 World 身份本身不违反宪法；它服务于“普通业务
只依赖 Game”。真正的底层存储类型仍应明确位于 `@zero-ecs/world/advanced`。

#### P1：修正文档中的事务可见性

现有文档中所有 `read-your-writes` 和“每帧最多迁移一次”的表述应统一为：

- 当前局部 EntityTransaction 内 read-your-writes；
- 独立事务在 collect 前彼此隔离；
- Query 在结构提交前看到旧 World；
- 每个 Migrations 提交批次、每个 Entity 最多一次最终迁移。

### 7.3 暂不迁移

以下内容符合边界，不应因为“进一步拆分”而移动：

- ComponentRegistry 不迁移到 Game；
- Query、QueryType、QueryProjection 不迁移到 Scheduler 或 Game；
- EntityPlanIndex 不迁移到 World；
- Migrations 不迁移到 World；
- Allocator/DataSet/Table 不迁移到共享包；
- Stage、Schedule 和拓扑排序不迁移到 Game；
- Startup/Update/Shutdown 不迁移到 Scheduler；
- HierarchyStore 不迁移到 World；
- 不恢复 game-bridge、world-query-projection、EntityRef 或 WorldView；
- 不为未来并行提前让 Scheduler 理解 Game 的 SystemParam。

## 8. 迁移顺序

### 阶段 A：固定宪法和门禁

1. 让当前架构文档引用本文。
2. 保留并扩展 package-boundary 测试。
3. 增加稳定入口导出快照或显式断言。
4. 修正事务可见性和位布局等文档表述。

### 阶段 B：完成 World 收敛

1. 删除全局 Chunk layoutVersion。
2. Query 改为按匹配 Archetype 局部同步。
3. 引入默认 0 的 `spareChunkLimit`。
4. 增加 Chunk 完全回收、局部 Query 同步和波动基准。

### 阶段 C：完成 Scheduler 收敛

1. 删除无效 builderId。
2. 强化空 SystemSet 与真实环路诊断。
3. 以多引擎基准决定 runner 预绑定。
4. 收回不必要的运行时内部类型。

### 阶段 D：完成 Game 控制面收敛

1. 收紧 Commands 内部提交协议。
2. 保持 EntityTransaction/Migrations 为 Game 私有实现。
3. 把 DevProfiler 改为实例局部观察。
4. 增强 Archetype/Chunk 诊断。
5. 审查根入口与可选 Feature 子路径。

不能把阶段 B、C、D 混成一次性能提交。每个阶段必须有独立测试与基准，以便判断收益来自
World 数据机制、Scheduler 调用开销还是 Game 策略。

## 9. 评审门禁

每个新增或修改必须回答：

1. 它属于机制、拓扑还是策略？
2. 是否引入了反向包依赖或隐式全局状态？
3. 是否把 Game 的业务安全要求塞进 World 热路径？
4. 是否让 Scheduler 认识了领域 token？
5. 是立即修改还是延迟修改，调用者能否清楚区分？
6. 新增分配发生在增长期、冷路径还是稳定热路径？
7. 是否扩大了稳定公共入口？
8. 是否可以通过现有底层 API 完成，而无需 bridge、wrapper 或重复状态？
9. 是否有对应测试固定职责边界？
10. 性能结论是否来自目标平台基准，而不是只来自代码形态推测？

任何无法明确归类的功能，默认先留在 Game 设计层评审，不直接进入 World 或 Scheduler。
