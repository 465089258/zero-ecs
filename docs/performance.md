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

- 固定工作集且相关池、数组、缓存和 Table 容量不发生收缩与再次增长时，不创建源码可见的 object、array、closure、iterator、tuple/result wrapper、Error、TypedArray 或 Buffer。
- 不依赖 JIT 内联、逃逸分析或临时对象消除来宣称零分配。
- 执行性能优先于 GC 数字；只有经过基准证明，才允许用对象池、高水位缓存和更复杂的复用结构换取收益。
- 达到新的 Entity、Command、EntityTransaction、Archetype 或 Query 缓存峰值时允许扩容；未被主动/自动裁剪的复用结构在工作集稳定后必须恢复到无显式分配路径。Archetype 的 `spareChunkLimit` 默认是 0，因此立即释放全部逻辑需求之外的连续空尾 Chunk；再次增长会重新创建 Buffer 租约、Table 和 TypedArray views。高级调用方可以显式提高保留上限，但不能只凭历史实体峰值声明结构迁移零分配。
- 热路径中的复用对象必须具有稳定 shape，并避免 Proxy、临时闭包、逐项 capability/context 和不必要的多态转发。
- 不为已经由 SystemParam 类型映射或接口能力分层排除的操作增加第二套运行时权限判断。

这里的“零显式分配”描述库源码可控制的行为，不承诺 JavaScript 引擎内部的 Map 节点、调用栈、JIT 或内联缓存实现绝对不分配。

默认配置下，固定实体总数的 A↔B 结构 churn 可能在 Chunk 边界持续释放和重建物理 Chunk。
这是当前明确的存储策略边界；性能测试必须把创建、释放和 GC 计入真实工作量。显式
`spareChunkLimit > 0` 与未来 Game 自适应策略必须作为独立存储 candidate 建立基线，不能
与 World facade、Query 或 Scheduler 改造混合归因。

### 冷路径原则

冷路径包括 build、init、start、stop、dispose、拓扑排序、参数 prepare、首次 Query 编译、错误、诊断和序列化。冷路径优先保证语义简单、生命周期清晰和可维护性：

- 允许直接创建生命周期明确的临时 Map、Set、数组、上下文和错误对象，用完后断开引用并交给 GC。
- 不得仅为减少少量低频分配而引入对象池、高水位缓存、复杂 reset 协议、全局 registry、额外 owner token 状态机或跨 Game 强引用缓存。
- 不池化错误、诊断结果、拓扑排序临时数组、一次性 prepare context 或 Builder 中间对象，除非独立数据证明它们已经成为实际瓶颈。
- `World.getTypes()` 和 `getCompLocation()` 是诊断/便利接口：前者成功时创建类型数组，后者成功时创建位置对象；它们不属于稳定 Tick 零显式分配 API。
- `World.resolve(entity, out)` 复用调用者提供的 `EntityAccess`，用于底层批量操作只校验并解析一次实体位置；结构变更后不得继续使用旧结果。
- 非热路径 GC 优化只接受实现同样简单的改写，或者有明确 CPU、内存、暂停时间数据支持的方案。
- “尽量减少分配”也包括及时释放长期引用；为避免年轻代短命对象而制造更多 old-generation 常驻对象不是有效优化。

简化的决策规则是：**热路径可以用经过证明的复杂度换取整体性能；冷路径不能用复杂度换取没有实际意义的 GC 数字。**

## Benchmark 分层与固定测量协议

本节适用于架构或热路径改造的 baseline/candidate 对照；`npm run test:no-jit` 仍然只是正确性 smoke，不能替代 benchmark。

### 两级性能门槛

| 层级 | 环境 | 使用时点 |
| --- | --- | --- |
| 核心门槛 | 固定 Node 22 patch 的正常 JIT、Node `--jitless`、源码分配审计 | 每次 Scheduler、Query、结构提交或 facade 架构改造必须通过，适合自动化或固定机器执行 |
| 发布前代表性门槛 | 固定完整版本的 Chromium，生产构建；主线程同时覆盖连续计算和 requestAnimationFrame 帧调度，声明支持 Worker 时覆盖 Worker 连续计算 | 进入发布候选前必须通过，不要求塞入每次日常 CI |

如果正式支持 Cocos、Laya、Electron、移动 WebView 或其他具有不同嵌入参数的宿主，每个 major/minor 发布周期还应选择至少一个实际目标宿主做代表性验证。Node `--jitless` 是保守的源码路径验证，不能替代 Chromium 或真实游戏宿主 benchmark。

### 运行环境

- 核心门槛使用 CI 的 Node 22 通道。收集 baseline 前必须在 benchmark 配置和结果中固定完整的 `node --version` patch 版本；candidate 必须使用同一可执行文件，跨 Node 版本的数字不得直接比较。
- Node 每个微基准场景分别使用 `node` 和 `node --jitless` 运行。
- Chromium baseline 前必须固定并记录完整浏览器/V8 版本与二进制来源；candidate 使用同一二进制。使用生产构建，在前台页面运行，并关闭后台计时器节流、遮挡窗口降速和 renderer backgrounding。
- Chromium 主线程必须分别运行同步紧循环的连续计算场景和 `requestAnimationFrame` 驱动的帧调度场景；两者使用同一生产 bundle，但分别报告，不能把紧循环结果称为完整游戏帧代表性结果。如果发布能力声明包含 Worker，则使用同一生产 bundle 和工作量增加 Worker 连续计算场景；没有 rAF 的 Worker 不伪造主线程帧指标。
- 结果必须记录提交、构建模式、操作系统、CPU、内存、Node/V8 或 Chromium/V8 版本和电源模式。Baseline 与 candidate 在同一机器、同一电源模式下完成。
- 计时进程不附加 inspector、profiler、`--trace-gc` 或其他会改变执行成本的参数。GC trace、DevTools trace、heap snapshot 或 `--expose-gc` 属于单独的分配诊断运行，不与延迟数据混合。

### 微基准工作量与轮次

- 一个 runtime pair 由两个相互隔离的 JS isolate/heap 组成：一个只加载 baseline，另一个只加载 candidate。每侧先完成 10 个不记录的 warmup round，再由外部控制器交替触发 50 个 paired measurement round；完整流程至少使用 5 个独立 runtime pair，最终至少得到 250 个 measurement pair。
- Node 的每个 runtime pair 使用两个预热完成的独立子进程，控制器只允许当前一侧进入计时段；不得在同一进程或 Worker isolate 中同时加载 baseline 与 candidate。Chromium 使用两个独立浏览器进程/实例组成一对，不在同一页面、renderer 或共享 V8 isolate 中加载两份 bundle；仅创建不同 browser context 不足以证明 heap 隔离。
- 每个 measurement pair 都包含相同工作量的 baseline 与 candidate，控制器按 `A/B → B/A` 交替触发，避免温度、降频和后台负载始终偏向一方。顺序在计时前确定，计时段内不创建随机数或调度对象；原始记录必须保留 runtime-pair id、round index、进程/浏览器标识和执行顺序。
- 空/少量 System 场景每 round 执行 1,000,000 次完整 `update()`，分别覆盖 0、1、4 个 no-op System。
- Scheduler 参数绑定专项场景绕过 Game，直接执行 `Scheduler.run()`，并以实际系统调用数作为
  分母。固定覆盖 1/16/64 个系统与 0/1/4/8/9 个参数，分别观察单系统 Stage、常见参数数量、
  0～8 专用 runner 边界和 `apply` fallback；不能用只有零参数的完整 `update()` 场景决定
  runner 选型。
- 实体读取场景固定 65,536 个已物化实体，每个方法循环 16 遍，即每 round 1,048,576 次调用；World 的 `valid/get/has` 分开计时。当前 `view()` 需要额外 row 才能完成实体字段访问，不对孤立的返回动作建立 facade benchmark。
- **固定起始状态的真实批量结构场景**每 round 处理 16,384 个实体，materialize、migrate 和 despawn 分开报告；只允许把一次性构造初始 World 排除在计时外。每个场景必须在 baseline 前定义逻辑起始状态 `S0`、目标子段 `T: S0 → S1` 和恢复子段 `R: S1 → S0`，一个完整 round 严格执行 `t0 → T → t1 → R → t2`。materialize 的恢复包括 despawn 并重新 reserve 下一轮句柄，migrate 的恢复是反向迁移和独立 flush，despawn 的恢复包括 reserve/materialize 替代实体；若实体身份不能保持，恢复必须在预分配输入缓冲中更新下一轮句柄，并把该工作计入 R。不得在计时外恢复 World、Table、池或输入数组。
- 真实批量结构场景同时报告目标子段 `(t1 - t0) / targetOperationCount`、恢复子段 `(t2 - t1) / entityCount`（命名为 `ns/entity-recovery`）和完整 cycle `(t2 - t0) / entityCount`。完整 cycle 是正式防隐藏成本指标；目标子段只用于定位操作差异，不能单独作为策略通过依据。T/R 引起的 Table 创建、释放、分配和 GC 都属于工作量；中间时钟读取是所有候选相同的固定成本，并纳入 A/A 校准。
- **已有容量内的内核场景**预先建立足够的源/目标 Table 容量，每 round 同样处理 16,384 个实体；目标与恢复组成完整 A→B→A cycle，被测过程不得创建、释放或改变 Table 身份/容量，用于单独观察结构迁移内核成本。preflight 和 round 后检查必须验证 Table 计数、身份、容量与版本符合该前提。
- 另设循环 churn 场景：固定 16,384 个实体和历史峰值，每个被测循环必须严格执行 `record A→B → flush → record B→A → flush`。两段操作不能在同一次 `Update.post` 提交前记录，否则同一 Entity 的 EntityTransaction 可能合并回 A 而不发生真实迁移。两次 record/flush 以及当前 Chunk 尾部释放、保留和再次创建都属于真实工作量，不能排除在计时、分配记录或 GC 诊断之外。
- churn 在正式计时前执行带完整 instrumentation 的正确性/诊断 preflight：每个 cycle 的 delta 必须满足 `appliedMigrationCount === entityCount * 2`、`flushCount === 2`，且全部实体最终位于 A。不能只检查最终 mask；必须使用 Archetype 版本、Chunk 数和诊断计数证明两次 flush 都真实执行。默认策略必须验证空尾 Chunk 全部释放；显式 `spareChunkLimit > 0` 场景验证只保留配置数量的连续尾 Chunk，随后 `push` 复用相同的连续 `chunkIdx`。
- churn 正式计时主要报告 `ns/entity-cycle`，一个 op 表示单个实体完整经历 A→B→A，分母为 `entityCount`；同时报告 `ns/applied-migration`，分母固定为 `entityCount * 2`。两项都包含 record 和 flush 的全部成本；配套诊断结果保存实际 `appliedMigrationCount` 并证明该固定分母成立，不得让候选自行选择更有利的分母。
- 正确性/诊断运行与正式计时运行必须使用独立构建。诊断运行允许在被测逻辑中更新迁移和 Chunk/Table 生命周期计数，但只比较每轮 delta，并在计时段外重置；这些运行不产生正式 ns/op。正式计时构建必须从产物中完全移除非生产计数器的字段、分支和写入，并通过产物审计确认，只保留 baseline/candidate 完全相同的时钟调用、操作序列和计时外 O(1) 状态校验。除 instrumentation 外，两种构建使用同一提交、生产优化配置和实验参数；完整状态、两次 flush 和 Chunk 身份先由诊断构建证明，正式构建在 round 后使用公开状态做一致的最终状态校验。
- 每个正式生产计时产物还必须在 warmup 前独立执行一次不计时的完整功能 preflight，不能只依赖 instrumentation 构建：record A→B 并第一次 flush 后，通过 Query 数量、`has`/等价公开状态和有语义的调用返回值验证全部 `entityCount` 个实体确实位于 B、A 中为零；再 record B→A 并第二次 flush，验证全部返回 A、B 中为零。materialize/despawn 场景同样在目标子段后验证 S1、恢复后验证 S0。任一正式产物 preflight 失败就中止该 runtime，不得产生 warmup 或 measurement 样本；preflight 结束在下一步 warmup 所需的逻辑 S0。
- materialize/despawn 的恢复只保证逻辑 S0，不保证 Entity 版本完全相同。实验清单必须计算正式 preflight、全部 warmup 和 measurement cycle 给每个槽位带来的 despawn 次数，并满足 `startVersion + plannedVersionIncrementsPerSlot <= ENTITY_VERSION_MASK`。诊断运行必须验证 `retiredSlotCount === 0`、首次准备后的 Entity slot counter 不再增长，并记录起止版本最小值/最大值；正式产物在计时外保存初始 slot index 集合，结束后验证当前句柄仍使用同一 index 集合并记录版本范围。调整 preflight、warmup、round 数或每 cycle 操作数时必须重新证明不会进入 12 位版本耗尽与槽位退休分支。
- Chromium 微基准使用与 Node 相同的实体数量、调用次数、warmup 和 measurement round；浏览器计时 API 的固定成本由 A/A 校准吸收，baseline/candidate 仍使用独立浏览器 heap。
- 场景需要改变上述规模时，必须在收集 baseline 前写入 benchmark 配置；收集 candidate 后不得为改善结果调整工作量。

### 微基准统计与默认接受条件

- 每个场景对 baseline 和 candidate 分别报告 round `ns/op median/p95`，并保留全部 paired round 原始数据。`ns/op` 越小越好，所以 p95 才表示慢侧；微基准不报告 50-round p99，也不使用方向相反的 throughput p95/p99 作为门槛。
- 对每个 measurement pair 计算回退比例 `r = candidateNsPerOp / baselineNsPerOp - 1`。五个 runtime pair 的 round 按相同环境合并为至少 250 个 `r` 样本用于总体 median/p95，同时保留并报告每个 runtime pair 自己的 median，避免聚合隐藏单对异常。
- 在比较 candidate 前，先用同一 baseline 构建执行完整 A/A paired 校准；A/A 的两侧也必须使用独立 isolate/heap。对每一对计算 `n = secondNsPerOp / firstNsPerOp - 1`。噪声带定义为 `max(1%, p95(abs(n)))`，并使用与 A/B 完全相同的 runtime-pair 数、round 数、进程/浏览器隔离和交替顺序。
- 默认规则适用于 Stage C facade 和未定义专用决策协议的普通实现变更：Candidate 的 paired `r` 总体 median 或 p95 任一大于噪声带，即视为该微基准门槛未通过；任一独立实例的 median 超过噪声带也必须调查，不能仅用池化结果掩盖。噪声带以内的差异允许视为无显著变化，但仍需报告原始数值。
- round ns/op p95 只表示长聚合 round 的慢侧波动，不能称为 Tick p95，也不能用于判断单次 GC 卡顿。
- 异常路径不参与微基准统计，但必须单独验证状态恢复和后续调用行为。

### 长时间 Tick 延迟与 GC 压力

微基准之外必须建立单独的代表性 Tick 场景，验证平均吞吐改善是否换来了更差的 GC 尾延迟：

- 每个完整 Tick 单独计时，不把多个 Tick 聚合后再反推尾延迟。
- 使用版本化的代表性工作量配置，明确记录 Entity、Query、Command、Migration、Event 和 Timer 的数量与每 Tick 变化率；这些数值必须在 baseline 前固定，candidate 后不得调整。
- 至少包含一个结构 churn 配置：固定实体总数，Tick N 记录 A→B 并由该 Tick 的 `Update.post` migration system flush，Tick N+1 记录 B→A 并再次 flush；两个 Tick 构成一个完整 churn cycle。每个 cycle 都必须满足两次真实迁移、两次 flush和最终回到 A，并验证当前连续尾 Chunk 的保留、释放和再次创建语义；不得在同一 flush 前合并记录，也不得用 Tick 外恢复隐藏成本。
- **连续计算模式**：Node、Chromium 主线程以及声明支持时的 Worker 都在同步紧循环中预热后连续测量至少 100,000 个 Tick，并在至少 5 个独立进程/浏览器实例中重复。它用于观察 ECS 计算成本、紧循环 GC 和 Tick 执行尾延迟，不包含真实帧调度。
- **主线程帧调度模式**：固定前台 Chromium 使用一个复用的 `requestAnimationFrame` callback，每个 callback 默认执行一个完整 Tick，预热后至少记录 20,000 帧并在至少 5 个独立浏览器实例中重复。分别保存 Tick 执行时长与相邻 rAF callback 间隔；后者才包含 vsync、idle GC、渲染器竞争和宿主调度影响。每帧 Tick 数如需改变，必须在 baseline 前固定。
- Baseline/candidate 在两种模式中都使用独立进程/浏览器 heap、相同计时方式和 `A/B → B/A` 运行顺序；一侧产生的垃圾不得由另一侧承担 GC。连续计算结果只能称为 ECS 连续计算结果；只有 rAF 模式的 callback 间隔可以作为浏览器主线程帧调度尾延迟证据，但它仍不代表未纳入工作量的完整渲染应用。
- 采样器在 warmup 开始前预分配固定长度的 `Float64Array(TICK_COUNT)`；测量循环内只允许读取时钟并按下标写入，不使用 `Array.push()`、逐 Tick `performance.mark/measure()`、对象样本或动态扩容。
- rAF 模式在 warmup 前分别预分配 Tick 执行时长和 callback 间隔的 `Float64Array(FRAME_COUNT)`；递归调度复用同一个 callback，不逐帧创建闭包或 Performance Timeline 条目。
- quantile 排序、汇总和结果序列化都在测量结束后执行。采样缓冲区的分配不计入 warmup 或测量段，baseline/candidate 使用完全相同的缓冲区类型和长度。
- 原始逐 Tick、Tick 执行时长和 rAF callback 间隔样本必须按场景和 runtime-pair side 分开保留，不能与微基准 round ns/op 混合，也不能把多个实例的原始样本直接池化后计算一个总 quantile。
- 每个隔离实例先独立计算 median/p95/p99/p99.9/max。对每个匹配 runtime pair 和每个 quantile `q`，计算 `r[q,i] = candidateQ[q,i] / baselineQ[q,i] - 1`；报告每一对的 baseline/candidate quantile、比例以及跨 runtime pair 的比例 median，不能只报告池化结果。
- A/A 使用完全相同的隔离实例和工作量，并为每个 quantile 单独计算 `n[q,i]`。默认只有 5 个 runtime pair 时，噪声带使用保守的 `band[q] = max(1%, max(abs(n[q,i])))`；只有在 baseline 前固定并采集至少 20 个独立 runtime pair 后，才可改用 `max(1%, p95(abs(n[q,i])))`。median、p95、p99 不共享一个总噪声带。
- 对 Stage C facade 和普通变更，median/p95/p99 是默认零显著回退硬门槛：某个 quantile 的匹配比例 median 大于其 `band[q]`，或至少两个 runtime pair 的该比例大于 `band[q]`，即判定回退。只有一个 runtime pair 超带时必须使用新的隔离 pair 重复该场景；若同类超带可复现则判定回退，否则保留为已调查异常并保存原始样本。
- 在每实例 20,000 帧的 rAF 协议下，p99.9 只有约 20 个尾部样本，因此 p99.9 与 max 默认只是调查指标，不作为硬门槛。若要把 rAF p99.9 升为硬门槛，必须在采集 baseline 前把每个实例提高到至少 100,000 帧或批准等价的独立重复方案；仍不得跨实例池化原始帧。
- 连续计算模式报告 Tick median/p95/p99/p99.9/max；rAF 模式分别报告 Tick 执行时长和 callback 间隔的相同指标。核心门槛至少在 Node 正常 JIT 运行；发布前代表性门槛同时通过固定 Chromium 主线程连续计算与 rAF，声明支持 Worker 时增加 Worker 连续计算。
- 延迟运行不启用 GC/DevTools trace。GC 次数、总暂停、最长暂停、分配速率和 heap 变化使用同一工作量另开诊断运行；测量工具产生的固定成本可以接受，但 baseline/candidate 必须完全一致。
- p99.9/max 中重复出现的长暂停必须调查并记录；即使它们尚未设为硬门槛，也不能因 median/p95/p99 通过而隐藏。

### 源码可见分配审计

每个热路径变更同时检查目标循环内是否新增：

- `new`、对象/数组字面量、spread、解构产生的包装结果；
- `map/filter/reduce`、数组迭代器、generator、临时 closure；
- Proxy、临时 writer/scope/token/context；
- TypedArray、Buffer、Error、字符串格式化或诊断快照；
- 结构 churn 中重新创建的 Buffer 租约、Table 和 TypedArray view；这些是当前策略的真实分配，不能因实体总数未创新高而从审计中排除；
- 容器查询、逐项 capability 验证或新的多态 facade 转发。
- 与 Readonly/Mut、非导出 internal 接口等编译期约束重复的运行时权限检查。

明确归类为诊断/冷路径的 API 可以分配，但必须在文档中标记，不能计入零显式分配热路径清单。性能测试只能提供证据，源码审计仍是分配语义的最终判据。

本文档记录核心运行路径在不假设 JIT 内联、逃逸分析或临时对象消除时的成本。这里的“稳定容量”是指对象池、数组和 Query 等复用缓存已经达到当前工作集的历史高水位且未被裁剪。Table/Buffer 还必须满足“容量没有被自动释放后再次增长”；历史实体峰值本身不足以满足稳定容量定义。

## 稳定 Tick 路径

| 路径 | 稳定容量分配 | 说明 |
|---|---|---|
| Game 阶段推进 | 无显式分配 | 使用索引循环执行 `first/fixed/last/post` |
| Scheduler.run | 无显式分配 | 通过 Stage token 的 Map 直接定位 runner 数组；参数数量已在 prepare 编译，0～8 参数使用固定 runner，更多参数复用冻结 args 执行 `apply` |
| QueryIter.next/current | 无显式分配 | 复用 QueryIter、entry 和 current tuple，只更新 count/current 引用 |
| flushCommandsSystem | 无显式分配 | Commands Service 的双高水位队列、used 游标与按类型对象池复用；新峰值才扩容 |
| EntityCommand 记录 | 无显式分配 | 固定四槽数字指令覆盖历史数组；新峰值才 `push` |
| 批量实体事务提交 | 条件式无显式分配 | Commands accumulator/分页索引稳定且源/目标 Chunk 容量不收缩再增长时成立；A→B→A churn 不属于该保证 |
| 纯 Set | 无显式对象分配 | 两遍验证后使用 chunkIdx/row 数字定位缓存列，不创建 location 或 Component view |
| 固定时间 | 无显式分配 | FixedTimeResource 输入，TimeState 原地更新 |
| 空 Timer/Event Tick | 无显式分配 | 索引循环；队列和池保持稳定 |

“无显式分配”描述源码可见行为，不依赖某个引擎的优化承诺；Map 查找、函数调用等引擎内部实现成本仍由运行时决定。

## 高水位与结构变化分配

| 场景 | 分配来源 | 当前策略 |
|---|---|---|
| 首次 Command 类型/并发峰值 | Command 实例、池数组、队列扩容 | 达到高水位后复用 |
| Commands 收集 EntityCommand | 首次触达 Entity 索引页及 accumulator 高水位 | 分页 TypedArray 保存 entity→accumulator，触达列表和命令数组复用 |
| 新 Archetype/Chunk | Archetype、DataSet Table、配置大小的 Buffer、TypedArray views | Chunk 首次创建；默认不保留空 Chunk，可通过 `spareChunkLimit` 显式设置连续尾部保留上限 |
| Entity/Archetype insert/remove | 新 Chunk/Buffer，或空尾 Chunk 释放后的再次增长 | ArchetypeRow 与 remove 返回值不分配对象；默认边界 churn 会重建 Buffer、Table 和 TypedArray views |
| Query 结构刷新 | 首次达到更多匹配 Chunk 时扩展高水位缓存 | matched/version、entry 和 current 跨 rebuild 复用；组件列直接借用 Archetype.views |
| Timer.once | InnerTask 首次对象及 bucket 扩容 | 槽直接保存池化 InnerTask，不再创建 LevelTask 包装对象 |
| EventService.event/post | EventArgs 首次实例及队列扩容 | EventArgs 按类型回池，双队列复用 |

### Chunk 与行所有权

当前存储策略已经收敛，不再由 DataSet 推断行状态：

```text
DataSet       只持有连续 Table 数组，push/pop 只作用于尾部
Table         只持有固定容量 TypedArray 列，负责 get/set/clear/copy
Archetype     拥有密集逻辑行、Chunk 数量、swap-remove 和结构版本
EntitySlots   拥有 Entity 版本与 Archetype/chunkIdx/row 映射
```

Archetype 的行位置 `ArchetypeRow` 是按自身 `chunkCapacity` 编码的 U32 临时位置；它不是
带版本的稳定句柄，swap-remove 后可能指向被搬入的其他实体。需要长期身份时必须保存
Entity。Table ID 与数组下标相同，因 DataSet 只允许尾部 `push/pop`，所以活动 ID 始终连续；
尾表释放后下一次 `push` 自然复用同一个 `chunkIdx`，不需要 free list、generation 或 ID
registry。

Archetype 在创建 Chunk 时一次建立：

```text
views[chunkIdx][componentId][fieldId]
entities[chunkIdx]
```

ComponentId 层使用稀疏数组，字段层直接保存 Table 中的 TypedArray。Query entry 只记录
`Archetype + chunkIdx`，刷新时直接借用这些稳定列；没有 WeakMap、`_componentColumns`、
DenseRows 或 Query 自己的组件列数组。Chunk 创建/释放递增 Archetype version，单纯的行数
变化不触发 Query 结构 rebuild；`QueryIter.next()` 每次从 Archetype 读取当前 Chunk 行数。

当前回收策略由 Archetype 明确执行：逻辑行始终密集，除最后一个活动 Chunk 外都满；删除
使用全局末行填补。`spareChunkLimit` 默认是 0，全部超出逻辑需求的空 Chunk 只从尾部
`pop`；提高限制只影响未来释放，不主动分配，降低限制会立即释放超额尾 Chunk。

默认边界 churn 会重新创建 Buffer、Table 和 TypedArray views，必须在 benchmark 中如实
计入。显式保留上限与未来 Game 自适应策略必须同时测量结构 cycle、Query、内存与 Tick
尾延迟，不能把存储策略收益归因给上层 API 变化。

## 已完成的无 JIT 调整

- Scheduler 每 Tick 不再使用 `find` 回调、数组 `filter/map` 或参数 spread。
- Game、QueryIter、Command、EntityCommand 合并、Timer 和 Event 的稳定遍历使用索引循环。
- 纯 Set 不再创建 Entity location 对象或组件列数组。
- ArchetypeRow 使用所属 Archetype 的 Chunk 容量动态编码为 U32；内部位置传递不创建对象，公开 `getCompLocation()` 诊断边界才物化 `{ chunkIdx, row }`。
- DataSet 和 Table 已移除行状态、insert/remove、DataRow、RemoveResult 与结构版本；Archetype 直接执行密集行插入和 swap-remove。
- Archetype.copyCommonTo 使用索引循环，无 JIT 时不依赖数组迭代器消除。
- Timer 槽直接保存 InnerTask，调度和层级降级不再创建 LevelTask 或临时 pending/deferred 数组。
- Query rebuild 使用高水位 entry/current 缓存和并行 Archetype 版本数组；entry 只保存 Archetype/chunkIdx，组件列直接引用公开缓存 views。
- Commands、ObjectPoolService、EventService 和 Timer 提供显式 trim API；只在场景切换等空闲边界释放历史峰值，不在 Tick 中自动裁剪。
- Listener.clear 主动断开 callback/context，包括重入派发期间已经写入 snapshot 的引用。
- Commands 使用 1024 Entity/页的稀疏 TypedArray 索引合并同批次事务，Structure System 应用后按高水位触达列表清零。
- World.view 返回的组件列数组由 `Archetype.views[chunkIdx][componentId]` 缓存；重复 view 不再执行 map 或创建数组。
- Allocator free-list 使用数字位置栈；每次 alloc 创建独立 Buffer 租约对象，release 后立即断开底层内存引用。
- Query rebuild 不再创建临时 Archetype view/closure，也不再为 entry 构建组件列数组。
- EntityCommand 默认不采集 Error stack，也不生成逐指令调试字符串。
- RandomService.seed 和 weight 的默认权重计算不创建闭包、tuple 结果或 reduce 回调。

## 保留的优化边界

以下项目需要独立数据和设计评审，不在当前实现中用复杂度换取未经证明的收益：

- Query Filter AST/DNF、System 依赖图和 Component 注册仍在构建阶段创建对象与集合；它们不进入 Tick。
- Table、Buffer 租约与 TypedArray view 是 Chunk 生命周期对象；当前既会在新容量时创建，也会在超过一个保留空 Chunk后再次增长时重建。是否改为更高保留量必须由 churn、Query、内存和缓存数据共同决定。
- Scheduler 的 Stage Map 和 WeakMap 缓存仍由宿主引擎管理；源码不假定其内部节点分配方式。

## 验证

- `npm run test`：普通运行时正确性与回归测试。
- `npm run build`：生产构建和声明生成。
- `npm run test:no-jit`：先构建，再使用 Node `--jitless` 执行 Command、Migration、纯 Set 和固定时间 smoke test。
- `npm run bench`：使用 `benchmarks/config.v1.json` 的 smoke 配置运行单构建采样；结果明确标记
  `approvalEligible: false`，只验证场景和产物可执行。
- `npm run bench:core`：运行固定核心工作量的单构建采样。正式 A/A 或 A/B 使用独立目录：

```text
node benchmarks/compare.mjs --baseline-root <baseline> --candidate-root <candidate> --profile core
```

  控制器为每个 scenario/pair 启动两个独立 Node 进程，分别预热，按 A/B、B/A 交替触发
  measurement round，并保留原始 paired `ns/op`。相同目录用于 A/A 校准；不同冻结构建用于
  A/B。两个目录必须使用同版本 benchmark 配置和已经完成的生产构建。

性能测试只能提供证据，不能证明零分配；代码审计和明确的数据所有权仍是主要判据。
