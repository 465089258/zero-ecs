# 性能与分配模型

本文档记录核心运行路径在不假设 JIT 内联、逃逸分析或临时对象消除时的成本。这里的“稳定容量”是指对象池、数组、Chunk 和 Query 缓存已经达到当前工作集的历史高水位。

## 稳定 Tick 路径

| 路径 | 稳定容量分配 | 说明 |
|---|---|---|
| Ecs 阶段推进 | 无显式分配 | 使用索引循环执行 `first/fixed/last` 和内部 Post |
| Scheduler.run | 无显式分配 | 通过 Stage token 的 Map 直接定位；0～8 参数直接调用，更多参数复用已编译 args 执行 `apply` |
| QueryIter.next/current | 无显式分配 | 复用 QueryIter、entry 和 current tuple，只更新 count/current 引用 |
| CommandService.flush | 无显式分配 | 双高水位队列、used 游标和按类型对象池复用；新峰值才扩容 |
| EntityCommand 记录 | 无显式分配 | 固定四槽数字指令覆盖历史数组；新峰值才 `push` |
| 纯 Set | 无显式对象分配 | 两遍验证后使用 tableId/row 数字定位直接写列，不创建 location 或 Component view |
| 固定时间 | 无显式分配 | FixedTimeResource 输入，TimeState 原地更新 |
| 空 Timer/Event Tick | 无显式分配 | 索引循环；队列和池保持稳定 |

“无显式分配”描述源码可见行为，不依赖某个引擎的优化承诺；Map 查找、函数调用等引擎内部实现成本仍由运行时决定。

## 高水位与结构变化分配

| 场景 | 分配来源 | 当前策略 |
|---|---|---|
| 首次 Command 类型/并发峰值 | Command 实例、池数组、队列扩容 | 达到高水位后复用 |
| EntityMigrationService.record | Map entry 及 MigrationPlan 首次扩容 | Plan、组件/重置/字段数组复用；第一版接受 Map 特征 |
| 新 Archetype/Table | Archetype、DataSet Table、16 KiB Chunk、TypedArray views | 结构变化时创建；空表按保留策略释放 |
| Entity/Archetype insert/remove | DataRow、RemoveResult、移动位置对象 | 当前仍按结构操作创建；后续单独评审数字编码位置 |
| Query 结构刷新 | matched/entry/current/component-column 数组和 Map entry | 仅 Archetype 或 Table 版本变化时 rebuild；遍历阶段复用 |
| Timer.once | InnerTask/LevelTask 首次对象及 bucket 扩容 | InnerTask 回池；LevelTask SoA 化作为后续优化候选 |
| EventService.event/post | EventArgs 首次实例及队列扩容 | EventArgs 按类型回池，双队列复用 |

## 已完成的无 JIT 调整

- Scheduler 每 Tick 不再使用 `find` 回调、数组 `filter/map` 或参数 spread。
- Ecs、QueryIter、Command、Migration、Timer 和 Event 的稳定遍历使用索引循环。
- 纯 Set 不再创建 Entity location 对象或组件列数组。
- Query rebuild 不再创建临时 Archetype view/closure；Table 组件列直接构建到持久 entry。
- EntityCommand 默认不采集 Error stack，也不生成逐指令调试字符串。
- RandomService.seed 和 weight 的默认权重计算不创建闭包、tuple 结果或 reduce 回调。

## 保留的优化边界

以下项目需要独立数据和设计评审，不在当前实现中用复杂度换取未经证明的收益：

- 用分页 TypedArray 索引替换 EntityMigrationService 的 Map。
- 将 DataRow/RemoveResult 改为数字编码或 caller-owned out 参数。
- 为 Query 建立统一结构版本，并跨 rebuild 复用 entry/current/component-column 缓存。
- 将 Timer 的 LevelTask 改为并行数组或侵入式节点。

## 验证

- `npm run test`：普通运行时正确性与回归测试。
- `npm run build`：生产构建和声明生成。
- `npm run test:no-jit`：先构建，再使用 Node `--jitless` 执行 Command、Migration、纯 Set 和固定时间 smoke test。

性能测试只能提供证据，不能证明零分配；代码审计和明确的数据所有权仍是主要判据。
