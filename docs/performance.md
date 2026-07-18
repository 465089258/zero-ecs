# 性能与分配模型

本文档记录核心运行路径在不假设 JIT 内联、逃逸分析或临时对象消除时的成本。这里的“稳定容量”是指对象池、数组、Buffer 和 Query 缓存已经达到当前工作集的历史高水位。

## 稳定 Tick 路径

| 路径 | 稳定容量分配 | 说明 |
|---|---|---|
| Ecs 阶段推进 | 无显式分配 | 使用索引循环执行 `first/fixed/last` 和内部 Post |
| Scheduler.run | 无显式分配 | 通过 Stage token 的 Map 直接定位；0～8 参数直接调用，更多参数复用已编译 args 执行 `apply` |
| QueryIter.next/current | 无显式分配 | 复用 QueryIter、entry 和 current tuple，只更新 count/current 引用 |
| flushCommandSystem | 无显式分配 | State 中的双高水位队列、used 游标与 Service 中的按类型对象池复用；新峰值才扩容 |
| EntityCommand 记录 | 无显式分配 | 固定四槽数字指令覆盖历史数组；新峰值才 `push` |
| 纯 Set | 无显式对象分配 | 两遍验证后使用 tableId/row 数字定位直接写列，不创建 location 或 Component view |
| 固定时间 | 无显式分配 | FixedTimeResource 输入，TimeState 原地更新 |
| 空 Timer/Event Tick | 无显式分配 | 索引循环；队列和池保持稳定 |

“无显式分配”描述源码可见行为，不依赖某个引擎的优化承诺；Map 查找、函数调用等引擎内部实现成本仍由运行时决定。

## 高水位与结构变化分配

| 场景 | 分配来源 | 当前策略 |
|---|---|---|
| 首次 Command 类型/并发峰值 | Command 实例、池数组、队列扩容 | 达到高水位后复用 |
| EntityMigrationService.record | 首次触达 Entity 索引页及 MigrationPlan 高水位 | 分页 TypedArray 保存 entity→plan，触达列表和 Plan 数组复用 |
| 新 Archetype/Table | Archetype、DataSet Table、16 KiB Buffer、TypedArray views | 结构变化时创建；空表按保留策略释放 |
| Entity/Archetype insert/remove | 新 Table/Buffer 的高水位扩容 | DataRow 使用安全整数编码，remove 返回数字状态，不创建位置与结果对象 |
| Query 结构刷新 | 首次达到更多匹配 Table 时扩展高水位缓存 | matched/version 数组、entry、current 和 component-column view 跨 rebuild 复用 |
| Timer.once | InnerTask 首次对象及 bucket 扩容 | 槽直接保存池化 InnerTask，不再创建 LevelTask 包装对象 |
| EventService.event/post | EventArgs 首次实例及队列扩容 | EventArgs 按类型回池，双队列复用 |

## 已完成的无 JIT 调整

- Scheduler 每 Tick 不再使用 `find` 回调、数组 `filter/map` 或参数 spread。
- Ecs、QueryIter、Command、Migration、Timer 和 Event 的稳定遍历使用索引循环。
- 纯 Set 不再创建 Entity location 对象或组件列数组。
- DataRow 使用低 14 位编码行号，DataSet/Entity/Archetype 内部位置传递不再创建对象；公开诊断边界按需物化位置。
- DataSet.remove 返回数字状态，迁移过程不再创建 RemoveResult/from/to 对象。
- Archetype.copyCommonTo 使用索引循环，无 JIT 时不依赖数组迭代器消除。
- Timer 槽直接保存 InnerTask，调度和层级降级不再创建 LevelTask 或临时 pending/deferred 数组。
- Query rebuild 使用高水位 entry/current/component-column 缓存，并用并行版本数组替代 Map；失活 Entry 会清除 Table/TypedArray 引用。
- CommandService、MigrationPlan、EventService 和 Timer 提供显式 trim API；只在场景切换等空闲边界释放历史峰值，不在 Tick 中自动裁剪。
- Listener.clear 主动断开 callback/context，包括重入派发期间已经写入 snapshot 的引用。
- EntityMigrationService 使用 1024 Entity/页的稀疏 TypedArray 索引替代 Map，Post 后按高水位触达列表清零。
- EntityService.view 的组件列数组按 Archetype/Table 生命周期缓存；重复 view 不再执行 map 或创建数组。
- Allocator free-list 使用数字位置栈；每次 alloc 创建独立 Buffer 租约对象，release 后立即断开底层内存引用。
- Query rebuild 不再创建临时 Archetype view/closure；Table 组件列直接构建到持久 entry。
- EntityCommand 默认不采集 Error stack，也不生成逐指令调试字符串。
- RandomService.seed 和 weight 的默认权重计算不创建闭包、tuple 结果或 reduce 回调。

## 保留的优化边界

以下项目需要独立数据和设计评审，不在当前实现中用复杂度换取未经证明的收益：

- Query Filter AST/DNF、System 依赖图和 Component 注册仍在构建阶段创建对象与集合；它们不进入 Tick。
- Table、Buffer 与 TypedArray view 是存储生命周期对象，只在结构容量达到新高水位时创建。
- Scheduler 的 Stage Map 和 WeakMap 缓存仍由宿主引擎管理；源码不假定其内部节点分配方式。

## 验证

- `npm run test`：普通运行时正确性与回归测试。
- `npm run build`：生产构建和声明生成。
- `npm run test:no-jit`：先构建，再使用 Node `--jitless` 执行 Command、Migration、纯 Set 和固定时间 smoke test。

性能测试只能提供证据，不能证明零分配；代码审计和明确的数据所有权仍是主要判据。
