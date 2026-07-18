# 性能与分配模型

## 设计优先级

正确性是所有实现必须满足的底线，不作为可以交换的优化项。在此基础上，本项目面向游戏运行时，按以下顺序做技术决策：

1. **执行性能第一**：优先保证 Tick 吞吐、帧时间、尾延迟、缓存友好性和低调用开销。
2. **GC 稳定性第二**：在不显著损害执行性能的前提下，热路径追求稳定工作集下零显式分配，非热路径尽量减少不必要分配和引用滞留。
3. **抽象和防误用服从前两项**：API 一致性、职责纯度和运行时守卫不能给 Scheduler、Query、组件访问或批量结构提交增加未经证明的永久成本。

GC 优化不能反过来支配执行路径。对象池、缓存、writer、数字编码或复用状态只有在 CPU、帧时间或 GC 数据能够证明收益时才值得引入；如果零分配方案增加了可测量的调用层级、分支、查表或状态维护成本，应优先选择整体运行性能更好的实现。最终判断同时观察正常 JIT、`--jitless`、平均 Tick、p95/p99 Tick、分配量和 GC 暂停，不能只看单一 ops/s 或单一分配数字。

约束同样遵循“编译期优先”：能由 TypeScript 泛型映射、readonly 视图、非导出接口或模块边界表达的使用协议，不在运行时重复检查。运行时只验证类型系统无法知道的生命周期、实例归属、动态数据和外部输入；热路径检查必须证明无法由类型设计替代并通过 benchmark。

### 热路径原则

热路径包括稳定 Tick 中的 Scheduler 执行、Query 迭代、组件字段访问，以及高频 Command、Migration、Timer 和 Event 处理。其规则是：

- 固定工作集和稳定高水位下，不创建源码可见的 object、array、closure、iterator、tuple/result wrapper、Error、TypedArray 或 Buffer。
- 不依赖 JIT 内联、逃逸分析或临时对象消除来宣称零分配。
- 执行性能优先于 GC 数字；只有经过基准证明，才允许用对象池、高水位缓存和更复杂的复用结构换取收益。
- 达到新的实体、Command、MigrationPlan、Archetype、Table 或 Query 缓存峰值时允许扩容；工作集稳定后必须恢复到无显式分配路径。
- 热路径中的复用对象必须具有稳定 shape，并避免 Proxy、临时闭包、逐项 capability/context 和不必要的多态转发。
- 不为已经由 SystemParam 类型映射或接口能力分层排除的操作增加第二套运行时权限判断。

这里的“零显式分配”描述库源码可控制的行为，不承诺 JavaScript 引擎内部的 Map 节点、调用栈、JIT 或内联缓存实现绝对不分配。

### 冷路径原则

冷路径包括 build、init、start、stop、dispose、拓扑排序、参数 prepare、首次 Query 编译、错误、诊断和序列化。冷路径优先保证语义简单、生命周期清晰和可维护性：

- 允许直接创建生命周期明确的临时 Map、Set、数组、上下文和错误对象，用完后断开引用并交给 GC。
- 不得仅为减少少量低频分配而引入对象池、高水位缓存、复杂 reset 协议、全局 registry、额外 owner token 状态机或跨 Game 强引用缓存。
- 不池化错误、诊断结果、拓扑排序临时数组、一次性 prepare context 或 Builder 中间对象，除非独立数据证明它们已经成为实际瓶颈。
- `EntityService.getTypes()` 和 `getCompLocation()` 是诊断/便利接口：前者成功时创建类型数组，后者成功时创建位置对象；它们不属于稳定 Tick 零显式分配 API。
- 非热路径 GC 优化只接受实现同样简单的改写，或者有明确 CPU、内存、暂停时间数据支持的方案。
- “尽量减少分配”也包括及时释放长期引用；为避免年轻代短命对象而制造更多 old-generation 常驻对象不是有效优化。

简化的决策规则是：**热路径可以用经过证明的复杂度换取整体性能；冷路径不能用复杂度换取没有实际意义的 GC 数字。**

## Benchmark 分层与固定测量协议

本节适用于架构或热路径改造的 baseline/candidate 对照；`npm run test:no-jit` 仍然只是正确性 smoke，不能替代 benchmark。

### 两级性能门槛

| 层级 | 环境 | 使用时点 |
| --- | --- | --- |
| 核心门槛 | 固定 Node 22 patch 的正常 JIT、Node `--jitless`、源码分配审计 | 每次 Scheduler、Query、结构提交或 facade 架构改造必须通过，适合自动化或固定机器执行 |
| 发布前代表性门槛 | 固定完整版本的 Chromium，生产构建，主线程；声明支持 Worker 时同时覆盖 Worker | 进入发布候选前必须通过，不要求塞入每次日常 CI |

如果正式支持 Cocos、Laya、Electron、移动 WebView 或其他具有不同嵌入参数的宿主，每个 major/minor 发布周期还应选择至少一个实际目标宿主做代表性验证。Node `--jitless` 是保守的源码路径验证，不能替代 Chromium 或真实游戏宿主 benchmark。

### 运行环境

- 核心门槛使用 CI 的 Node 22 通道。收集 baseline 前必须在 benchmark 配置和结果中固定完整的 `node --version` patch 版本；candidate 必须使用同一可执行文件，跨 Node 版本的数字不得直接比较。
- Node 每个微基准场景分别使用 `node` 和 `node --jitless` 运行。
- Chromium baseline 前必须固定并记录完整浏览器/V8 版本与二进制来源；candidate 使用同一二进制。使用生产构建，在前台页面运行，并关闭后台计时器节流、遮挡窗口降速和 renderer backgrounding。
- Chromium 至少运行主线程场景；如果发布能力声明包含 Worker，则使用同一生产 bundle 和工作量再运行 Worker 场景。
- 结果必须记录提交、构建模式、操作系统、CPU、内存、Node/V8 或 Chromium/V8 版本和电源模式。Baseline 与 candidate 在同一机器、同一电源模式下完成。
- 计时进程不附加 inspector、profiler、`--trace-gc` 或其他会改变执行成本的参数。GC trace、DevTools trace、heap snapshot 或 `--expose-gc` 属于单独的分配诊断运行，不与延迟数据混合。

### 微基准吞吐工作量与轮次

- 每个实现先执行 10 个不记录的 warmup round，再执行 50 个 measurement round；完整流程至少在 5 个独立运行时实例中重复（Node 使用独立进程，Chromium 使用新的浏览器上下文或实例）。
- Baseline 与 candidate 按 `A/B → B/A` 交替顺序执行成对 round，避免温度、降频和后台负载始终偏向一方。顺序在计时前确定，计时段内不创建随机数或调度对象。
- 空/少量 System 场景每 round 执行 1,000,000 次完整 `update()`，分别覆盖 0、1、4 个 no-op System。
- 实体读取场景固定 65,536 个已物化实体，每个方法循环 16 遍，即每 round 1,048,576 次调用；Framework v1 WorldView 只对 `valid/get/has` 分开计时。当前 `view()` 需要额外 row 才能完成实体字段访问，不对孤立的返回动作建立 facade benchmark。
- 批量结构场景每 round 处理 16,384 个实体，materialize、migrate 和 despawn 分开报告；准备数据和恢复工作集不计入目标操作计时，开始测量前必须达到相同容量高水位。
- Chromium 微基准使用与 Node 相同的实体数量、调用次数、warmup 和 measurement round；浏览器计时 API 的固定成本由 A/A 校准吸收。
- 场景需要改变上述规模时，必须在收集 baseline 前写入 benchmark 配置；收集 candidate 后不得为改善结果调整工作量。

### 微基准吞吐统计与接受条件

- 每个场景报告归一化的 ns/op 和 **round throughput median/p95/p99**，并保留原始 paired round 数据。
- 这里的 p95/p99 表示长聚合 round 之间的吞吐波动，不得称为 Tick p95/p99，也不能用于判断单次 GC 卡顿。
- 在比较 candidate 前，先用同一 baseline 构建执行一次 A/A 交替校准。噪声带定义为 `max(1%, A/A 成对差值绝对比例的 p95)`。
- Candidate 的 round throughput median、p95 或 p99 任一回退超过噪声带，即视为微基准门槛未通过；噪声带以内的差异允许视为无显著变化，但仍需报告原始数值。
- 异常路径不参与吞吐统计，但必须单独验证状态恢复和后续调用行为。

### 长时间 Tick 延迟与 GC 压力

微基准之外必须建立单独的代表性 Tick 场景，验证平均吞吐改善是否换来了更差的 GC 尾延迟：

- 每个完整 Tick 单独计时，不把多个 Tick 聚合后再反推尾延迟。
- 使用版本化的代表性工作量配置，明确记录 Entity、Query、Command、Migration、Event 和 Timer 的数量与每 Tick 变化率；这些数值必须在 baseline 前固定，candidate 后不得调整。
- 每个实现预热后连续测量至少 100,000 个 Tick，并在至少 5 个独立进程或浏览器实例中重复。Baseline/candidate 使用相同计时方式和 `A/B → B/A` 顺序。
- 采样器在 warmup 开始前预分配固定长度的 `Float64Array(TICK_COUNT)`；测量循环内只允许读取时钟并按下标写入，不使用 `Array.push()`、逐 Tick `performance.mark/measure()`、对象样本或动态扩容。
- quantile 排序、汇总和结果序列化都在测量结束后执行。采样缓冲区的分配不计入 warmup 或测量段，baseline/candidate 使用完全相同的缓冲区类型和长度。
- 分别报告 Tick median、p95、p99、p99.9 和 max；原始逐 Tick 样本必须保留，不能与 round throughput 指标混合。
- 核心门槛至少在 Node 正常 JIT 运行；发布前代表性门槛在固定 Chromium 主线程运行，声明支持 Worker 时增加 Worker 运行。
- 延迟运行不启用 GC/DevTools trace。GC 次数、总暂停、最长暂停、分配速率和 heap 变化使用同一工作量另开诊断运行；测量工具产生的固定成本可以接受，但 baseline/candidate 必须完全一致。
- Tick quantile 使用同场景 A/A 校准后的噪声带判断；`max` 单独报告和调查，不因一次不可复现尖峰直接判失败，但重复出现的长暂停必须视为回退。

### 源码可见分配审计

每个热路径变更同时检查目标循环内是否新增：

- `new`、对象/数组字面量、spread、解构产生的包装结果；
- `map/filter/reduce`、数组迭代器、generator、临时 closure；
- Proxy、临时 writer/scope/token/context；
- TypedArray、Buffer、Error、字符串格式化或诊断快照；
- 容器查询、逐项 capability 验证或新的多态 facade 转发。
- 与 WorldView、Readonly/Mut、非导出 internal 接口等编译期约束重复的运行时权限检查。

明确归类为诊断/冷路径的 API 可以分配，但必须在文档中标记，不能计入零显式分配热路径清单。性能测试只能提供证据，源码审计仍是分配语义的最终判据。

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
