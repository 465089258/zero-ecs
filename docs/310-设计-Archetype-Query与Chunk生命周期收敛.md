# Archetype、Query 与 Chunk 生命周期收敛方案

> 类别：设计
> 状态：已完成
> 权威性：规范性
> 适用范围：`@zero-ecs/world`、`@zero-ecs/game`
> 最后更新：2026-07-23
> 上位文档：[架构宪法](./100-架构-架构宪法.md)

实施说明：阶段 A～C 已实施并通过测试、构建；独立 benchmark 场景已落地，正式 A/A 与
A/B 数据待冻结构建后采集。阶段 D Game 自适应策略延期，不属于阶段 A～C 的完成条件。

本文统一解决改造前的以下三个相关问题：

1. 任意 Archetype 的 Chunk 变化都会递增 `World.layoutVersion`，从而唤醒全部 Query。
2. 空 Archetype 固定保留一个 Chunk，导致 Buffer 分散滞留在各个 Archetype。
3. 完全释放空 Chunk 后，实体数量在 Chunk 边界反复波动可能产生重复
   `ArchetypeChunk` 和 TypedArray 视图创建。

目标是让变化只影响真正相关的对象，同时让 Allocator 成为统一的物理内存复用中心。

## 1. 设计结论

采用以下职责划分：

```text
World.version
    只表达 Archetype 集合变化

Archetype.version
    只表达该 Archetype 的物理 Chunk 集合变化

QueryArchetypeEntry.version
    记录 Query 已经同步到的 Archetype.version

Archetype.spareChunkLimit
    表达该 Archetype 最多允许保留多少个空闲尾 Chunk
    默认值为 0
```

对应行为：

```text
新增 Archetype
    → World.version++
    → Query.iter() 只匹配新增 Archetype

已有 Archetype 新增或释放 Chunk
    → Archetype.version++
    → QueryIter.next() 进入该 Archetype 时局部同步

未被 Query 匹配的 Archetype 发生 Chunk 变化
    → 对该 Query 没有任何影响

普通实体行数或组件值变化
    → 不修改任何结构版本
```

删除全局 Chunk 布局通知：

- 删除 `World._layoutVersion`；
- 删除 `World.layoutVersion`；
- 删除 `World._markLayoutChanged`；
- 删除 `Archetype.onLayoutChange`；
- 删除 `IArchetypeSource.layoutVersion`；
- 删除 `Query._layoutVersion`。

## 2. 非目标

本次改造不解决：

- 在活跃 Query 迭代期间即时迁移或销毁实体；
- Query 重入；
- Game 迁移命令的合并策略；
- Allocator Block 的自动 `trim()`；
- 根据操作系统内存压力自动调整缓存；
- 为 Buffer、Table 或 TypedArray 增加对象池。

World 仍然是底层不安全入口。结构变化必须发生在没有冲突 Query 正在迭代的时机。

## 3. 核心不变量

### 3.1 Archetype 身份

Archetype 创建后保持稳定：

- 不因实体数量变成 0 而从 World 删除；
- `mask`、`types`、`name` 和 `chunkCapacity` 不变化；
- World 中的 Archetype 索引不复用；
- 空 Archetype 可以没有任何物理 Chunk。

### 3.2 逻辑 Chunk 与物理 Chunk

逻辑 Chunk 数：

```ts
logicalChunkCount = Math.ceil(count / chunkCapacity);
```

物理 Chunk 数：

```ts
allocatedChunkCount = _chunks.length;
```

始终满足：

```ts
logicalChunkCount <= allocatedChunkCount;

allocatedChunkCount <=
    logicalChunkCount + spareChunkLimit;
```

默认 `spareChunkLimit === 0`，因此默认状态下：

```ts
allocatedChunkCount === logicalChunkCount;
```

每个物理下标只对应一个 `ArchetypeChunk`：

```ts
_chunks.tables[chunkIdx] instanceof ArchetypeChunk;
```

`ArchetypeChunk` 继承 `Table`，并在创建时一次性绑定：

- `columns`：按物理布局排列的稠密列，供整行复制；
- `entities`：`columns[ENTITY_COLUMN]` 的实体列别名；
- `views`：按 ComponentId 稀疏索引、指向相同 TypedArray 的组件字段列。

因此 Archetype 不再平行维护 `data`、`views[]` 和 `entities[]` 三组序列。稠密列与
稀疏视图只是同一批 TypedArray 的两套引用索引，不复制组件数据。

### 3.3 版本

`World.version` 只在以下情况递增：

- 新 Archetype 追加到 World；
- World 终态释放并清空 Archetype 列表。

`Archetype.version` 只在物理 Chunk 集合变化时递增：

- `ArchetypeChunks.push()` 成功并完整建立一个 `ArchetypeChunk`；
- `ArchetypeChunks.pop()` 并释放尾部 `ArchetypeChunk`；
- Archetype dispose 清空已有物理 Chunk。

以下情况不递增 `Archetype.version`：

- Chunk 内实体数量变化；
- swap-remove；
- 逻辑 Chunk 从空变为活动，但对应物理 Chunk 已经保留；
- 组件字段值变化；
- `spareChunkLimit` 改变但没有实际创建或释放 Chunk。

版本只作为变化 epoch，不承诺可用于精确统计变化次数。

## 4. World 版本收敛

目标接口：

```ts
export interface IArchetypeSource {
    /** Archetype 集合追加或终态清空时递增。 */
    readonly version: number;

    readonly archetypes: readonly Archetype[];
}
```

数据源存活期间只允许追加 Archetype，已有 Archetype 的身份、顺序和 Mask 保持稳定。
终态释放时必须清空列表并递增版本，释放后不允许在同一个数据源上重建等长的新列表。
因此 Query 可以通过 `_knownArchetypeCount` 的回退识别终态清空，不需要在稳定热路径扫描
已知前缀的对象身份。

World 不再接收 Archetype 的 Chunk 变化回调：

```ts
const archetype = new Archetype(
    mask,
    types,
    this._allocator,
);
```

新增 Archetype 后：

```ts
this._archetypes.push(archetype);
this._version++;
```

已有 Archetype 的 Chunk 数变化不会修改 `World.version`。

## 5. Query 匹配与同步

Query 分别缓存：

```ts
private _knownArchetypeCount = 0;
private _worldVersion = -1;
```

每个匹配的 Archetype 对应一个 Entry：

```ts
interface QueryArchetypeEntry<Components> {
    readonly archetype: Archetype;
    readonly chunks: QueryChunkEntry<Components>[];

    /** 当前有效的高水位 ChunkEntry 数量。 */
    chunkCount: number;

    /** Query 已同步到的 Archetype.version。 */
    version: number;
}
```

### 5.1 `Query.iter()`

`iter()` 只检查 World 的 Archetype 集合版本：

```ts
iter(): QueryIter<Components> {
    if (this._worldVersion !== this._archetypes.version) {
        this.synchronizeArchetypes();
    }

    return this._iterator.reset(
        this._entries,
        this._entries.length,
        this._selections,
    );
}
```

稳定状态下 `Query.iter()` 保持 O(1)，不会扫描已匹配 Archetype。

### 5.2 新增 Archetype

`synchronizeArchetypes()` 只处理新增区间：

```ts
private synchronizeArchetypes(): void {
    const archetypes = this._archetypes.archetypes;

    if (archetypes.length < this._knownArchetypeCount) {
        this.releaseAllEntries();
        this._knownArchetypeCount = 0;
    }

    for (
        let index = this._knownArchetypeCount;
        index < archetypes.length;
        index++
    ) {
        const archetype = archetypes[index];
        if (!this.matches(archetype)) continue;

        const entry = createArchetypeEntry(archetype);
        synchronizeChunks(entry, this._selections);
        this._entries.push(entry);
    }

    this._knownArchetypeCount = archetypes.length;
    this._worldVersion = this._archetypes.version;
}
```

旧 Archetype 的 Mask 不变化，因此不需要重新匹配。

### 5.3 已有 Archetype 的 Chunk 变化

Chunk 同步移动到 `QueryIter.next()`，并且只在刚进入一个 Archetype 时检查：

```ts
while (archetypeIndex < length) {
    const entry = entries[archetypeIndex];

    if (
        chunkIndex === 0 &&
        entry.version !== entry.archetype.version
    ) {
        synchronizeChunks(entry, selections);
    }

    while (chunkIndex < entry.chunkCount) {
        const currentChunkIndex = chunkIndex++;
        const count =
            entry.archetype.chunkRowCount(currentChunkIndex);

        if (count === 0) continue;

        const current =
            entry.chunks[currentChunkIndex].current;

        current[0] = count;
        // 更新 iterator 状态并返回。
    }

    archetypeIndex++;
    chunkIndex = 0;
}
```

`chunkIndex === 0` 很重要。一个 Archetype 包含多个 Chunk 时，后续 `next()` 不重复读取
和比较版本。

结构变化发生在同一 Archetype 已经开始迭代之后仍属于不安全用法，不在此处补偿。

### 5.4 Chunk 增量同步

```ts
function synchronizeChunks(
    entry: QueryArchetypeEntry,
    selections: readonly Selection[],
): void {
    const archetype = entry.archetype;
    const activeCount = archetype.allocatedChunkCount;
    let stableCount = Math.min(entry.chunkCount, activeCount);

    // Chunk 只允许从连续尾部 push/pop。从尾部反向寻找仍绑定同一
    // ArchetypeChunk 的公共前缀，同时覆盖“先释放、后重建到相同数量”的情况。
    while (stableCount > 0) {
        const chunkIdx = stableCount - 1;
        const chunk = archetype.chunkAt(chunkIdx);
        if (
            chunk !== undefined &&
            entry.chunks[chunkIdx].current[1] === chunk.entities
        ) {
            break;
        }
        stableCount--;
    }

    for (
        let chunkIdx = stableCount;
        chunkIdx < entry.chunkCount;
        chunkIdx++
    ) {
        releaseEntry(entry.chunks[chunkIdx]);
    }

    for (
        let chunkIdx = stableCount;
        chunkIdx < activeCount;
        chunkIdx++
    ) {
        writeEntry(entry, chunkIdx, selections);
    }

    entry.chunkCount = activeCount;
    entry.version = archetype.version;
}
```

不能只比较 `entry.chunkCount` 和 `activeCount`。一个安全提交批次内可能先释放尾 Chunk，
随后又创建到相同数量；此时数量相同但 TypedArray 已经更换。旧 Buffer 租约可能已经被
Allocator 复用，Query 必须根据实体列对象身份重写被替换的连续尾部。

这里直接复用 `current[1]` 中已经缓存的 EntitySet 身份，不增加 generation、Map 或额外
Chunk 引用。纯增长和纯缩减只检查一次公共前缀；发生替换时只扫描并重写被替换的尾部。

`QueryChunkEntry` 继续采用高水位复用：

- 新增 Chunk 时优先复用已有 Entry；
- 释放 Chunk 时清除 EntitySet 和组件 TypedArray 引用；
- 不删除 Entry 对象；
- 同一 Chunk 索引重新出现时复用 `current` 元组。

### 5.5 行数变化

Query 不缓存固定行数。每次遍历 Chunk 都读取：

```ts
archetype.chunkRowCount(chunkIdx);
```

因此以下变化不需要任何版本通知：

- 当前最后一个 Chunk 增减实体；
- swap-remove；
- 保留的空 Chunk 重新变为活动 Chunk；
- 活动 Chunk 重新变为空，但仍在 `spareChunkLimit` 范围内。

## 6. Chunk 完全回收

删除固定常量：

```ts
const RETAIN_EMPTY_CHUNKS = 1;
```

改为每个 Archetype 独立配置：

```ts
export class Archetype {
    private _spareChunkLimit = 0;

    get spareChunkLimit(): number {
        return this._spareChunkLimit;
    }

    setSpareChunkLimit(value: number): void {
        if (!Number.isSafeInteger(value) || value < 0) {
            throw new RangeError(
                "spareChunkLimit must be a non-negative safe integer",
            );
        }

        if (value === this._spareChunkLimit) return;

        this._spareChunkLimit = value;
        this.releaseUnusedChunks();
    }
}
```

不使用无校验的公开可写字段，原因是：

- 必须拒绝负数、小数、NaN 和无限值；
- 降低保留量时必须立即释放超额 Chunk；
- setter 本身需要维护版本和 Query 缓存失效语义。

### 6.1 释放规则

```ts
private releaseUnusedChunks(): void {
    const keep = Math.min(
        this._chunks.length,
        this.chunks + this._spareChunkLimit,
    );
    let failed = false;
    let firstError: unknown;

    while (this._chunks.length > keep) {
        const before = this._chunks.length;
        try {
            this._chunks.pop();
        } catch (error) {
            if (!failed) {
                failed = true;
                firstError = error;
            }
        }

        if (this._chunks.length < before) {
            this.version++;
            continue;
        }

        // pop 未改变集合，继续循环不会取得进展。
        break;
    }

    if (failed) throw firstError;
}
```

Chunk 的 Table、实体列与稀疏视图由同一个对象共同释放，不再存在三个数组失步问题。
只要 Chunk 已经从 `_chunks` 物理集合移除，`Archetype.version` 就必须反映该变化，即使
随后释放自定义 Buffer 时抛错。实现不能出现 `_chunks.length` 已改变但版本没有改变的状态。

`ArchetypeChunks.pop()` 或其调用方必须能区分“集合未改变”和“集合已经改变但资源释放
失败”。批量释放和 `dispose()` 应继续处理剩余 Chunk，记录第一个错误，完成能够完成的
清理后再抛出。`setSpareChunkLimit()` 在已经 dispose 的 Archetype 上必须拒绝调用。

默认值为 0 时，最后一个实体删除后：

```text
Archetype.count               = 0
Archetype.chunks              = 0
Archetype.allocatedChunkCount = 0
Archetype._chunks.length      = 0
```

Archetype 和 ArchetypeChunks 的布局元数据仍保留，但不持有活动 Buffer。

### 6.2 Buffer 归还

当前归还路径无需改造：

```text
Archetype.releaseUnusedChunks()
    → ArchetypeChunks.pop()
    → ArchetypeChunk.dispose()
    → AllocatorBuffer.dispose()
    → Allocator.releaseBuffer()
    → Buffer 位置进入 Allocator freeList
```

这里的“回收”表示 Buffer 租约立即可供同一 Allocator 的其他使用者复用。底层 MemoryBlock
仍由 Allocator 保留；只有整个 Block 空闲并调用 `Allocator.trim()` 后，Block 才会被删除。

Allocator 统计表达租约和 Block 的所有权状态，不承诺 JavaScript 引擎已经回收底层
ArrayBuffer。休眠 Query 在下一次进入相关 Archetype 前可能仍缓存旧 TypedArray；即使 Block
已经从 Allocator 删除，这些引用也可能延后实际 backing memory 的 GC。内存 benchmark
必须区分 Allocator 账面统计和运行时实际 ArrayBuffer/heap 占用。

## 7. `spareChunkLimit` 语义

### 7.1 默认值

```ts
spareChunkLimit = 0;
```

World 不主动猜测 Archetype 是否会波动。

### 7.2 增大

```ts
archetype.setSpareChunkLimit(2);
```

只改变未来释放上限，不主动申请 Chunk。

如果 Archetype 当前已经没有物理 Chunk，增大保留量不会重新分配 Buffer。

### 7.3 减小

```ts
archetype.setSpareChunkLimit(0);
```

立即调用 `releaseUnusedChunks()`，释放超过新上限的尾 Chunk。每个实际释放都会更新
`Archetype.version`，相关 Query 在下一次进入该 Archetype 时同步。

如果降低保留值导致实际 Chunk 被释放，这同样属于底层结构变化，必须在没有相关 Query
正在迭代的安全点执行。Game 应在迁移提交或专用内存维护阶段调整该值。

### 7.4 复用空 Chunk

保留的空 Chunk 已经作为完整 `ArchetypeChunk` 存在于 `_chunks.tables`，Query 的高水位
ChunkEntry 也仍指向它的实体列和组件列。

实体再次增长进入该 Chunk 时：

- 不调用 `ArchetypeChunks.push()`；
- 不创建 Buffer、Table 或 TypedArray views；
- 不修改 `Archetype.version`；
- Query 通过实时 `chunkRowCount()` 直接看到新行。

## 8. Game 层自适应策略

World 只提供机制。是否保留、保留多少、何时归零由 Game 决定。

自适应策略只能实现为 Game 内部迁移策略，而不是 World 自动策略。本次 World P0
只提供显式 `setSpareChunkLimit()` 机制，不实现或默认启用 Game 自动检测。以下内容保留为
后续独立 candidate，只有 benchmark 证明收益后才进入实施。

### 8.1 建议状态

```ts
interface ArchetypeChurnState {
    readonly archetype: Archetype;

    lastVersion: number;
    lastAllocatedChunks: number;
    lastDirection: -1 | 0 | 1;

    score: number;
    lastTouchedFrame: number;
    appliedSpareLimit: number;
}
```

只跟踪迁移批次实际触及的 Archetype，不在每帧扫描 World 的全部 Archetype。

Game Migrations 在应用事务时：

- 迁移前通过 `World.resolve()` 取得源 Archetype；
- 迁移 callback 取得目标 Archetype；
- 将源和目标加入调用者复用的 touched 列表；
- 使用 Game-local 索引或 epoch 标记去重；
- 批次结束后只更新 touched Archetype 的波动状态。

### 8.2 波动判断

不能只比较最终 `allocatedChunkCount`，因为一次批次内可能先释放后创建，最终数量相同。

可以组合判断：

```text
version 未变化
    → 没有物理 Chunk 变化

version 变化且 allocatedChunkCount 未变化
    → 窗口内发生过释放/创建或其他物理布局变化

allocatedChunkCount 方向反复翻转
    → 跨窗口边界振荡
```

`Archetype.version` 仍只作为 epoch，不使用版本差值推导精确次数。

### 8.3 建议策略

以下数值只作为初始 benchmark 候选，不是公共契约：

```text
连续观察到 3 次 Chunk 波动
    → spareChunkLimit = 1

波动跨越多个 Chunk
    → spareChunkLimit = min(波动幅度, 2)

连续 120 帧未触及或未变化
    → spareChunkLimit = 0

场景切换、内存裁剪或显式压力事件
    → 全部动态 spareChunkLimit = 0
    → 如果 Game 拥有默认 Allocator，可以 allocator.trim()
```

所有 World 都可以把动态保留值降为 0，让 World 归还自己的 Buffer 租约。只有
GameBuilder 自己创建并拥有的默认 Allocator 才允许由 Game 主动 `trim()`。通过
`setAllocator()` 或 `setWorld()` 引入的外部 Allocator 仍由外部所有者决定是否和何时裁剪；
`IAllocator` 本身也不承诺提供 `trim()`。

必须提供上限，避免异常 Archetype 长期钉住大量 Buffer：

```ts
maxAdaptiveSpareChunksPerArchetype = 2;
```

显式用户配置和自适应配置的优先级需要在实施前确定。建议：

```text
显式固定配置 > Game 自适应配置 > World 默认值 0
```

自动策略应用保留值后必须立即刷新自身的 `lastVersion`、`lastAllocatedChunks` 和方向基线，
或以等价方式标记策略自身导致的释放。策略造成的版本变化不能再次计入业务 churn，否则
安静期降级可能反过来触发重新升档。

### 8.4 自适应预热

Game 第一次发现波动时，Chunk 可能已经释放。第一次重新增长仍然需要创建 Table 和
TypedArray views，这是允许的。

自适应策略的目标是降低持续波动成本，而不是消除第一次分配：

```text
首次波动
    → 观察

持续波动达到阈值
    → 设置 spareChunkLimit

后续波动
    → 复用空 Chunk

进入安静期
    → 降回 0 并归还 Buffer
```

## 9. 为什么不池化 Buffer、Table 或 TypedArray

Buffer 归还 Allocator 后可能被其他布局使用。原生 TypedArray 不能重新绑定新的
ArrayBuffer 区域，因此重新取得不同 Buffer 时必须创建新视图。

不建议复用已经 dispose 的 Buffer 或 Table 对象：

- 外部 advanced 调用者可能仍持有旧对象；
- 对象复用会产生句柄 ABA；
- 为防止旧引用访问新租约需要增加代际校验；
- 校验成本会进入底层访问路径；
- TypedArray views 最终仍然需要重新创建。

`spareChunkLimit` 明确选择继续持有某个物理 Chunk，因此可以安全复用原视图；默认值 0
则把 Buffer 使用权完整交还 Allocator。

## 10. 变化流程

### 10.1 新增 Archetype

```text
World 创建 Archetype
    → 追加到 archetypes
    → World.version++

Query.iter()
    → 发现 World.version 变化
    → 只检查新增 Archetype
    → 匹配则建立 QueryArchetypeEntry
```

### 10.2 已有匹配 Archetype 新增物理 Chunk

```text
Archetype.ensureChunk()
    → ArchetypeChunks.push()
    → 一次性建立 ArchetypeChunk、entities 和稀疏 views
    → Archetype.version++

Query.iter()
    → World.version 未变化
    → O(1) reset

QueryIter.next() 首次进入该 Archetype
    → Entry.version != Archetype.version
    → 只同步该 Entry
```

### 10.3 已有匹配 Archetype 释放物理 Chunk

```text
Archetype.remove()
    → count 降低
    → 超过 spareChunkLimit 的尾 Chunk 被 pop
    → Archetype.version++

QueryIter.next() 首次进入该 Archetype
    → 局部同步
    → 清除被释放 Chunk 的缓存列引用
```

### 10.4 尾 Chunk 释放后在同步前恢复到相同数量

```text
Query 已缓存 Chunk 0..N
    → Archetype 释放尾部 Chunk M..N
    → 同一安全提交批次重新创建 Chunk M..N
    → allocatedChunkCount 最终仍为 N + 1
    → Archetype.version 已变化

QueryIter.next() 首次进入该 Archetype
    → 从尾部比较缓存 EntitySet 与当前 chunk.entities 身份
    → 找到稳定公共前缀 0..M-1
    → 清除并重写 M..N 的缓存列引用
```

数量相同不表示物理 Chunk 身份相同。该流程是 Query Chunk 同步的必测正确性边界。

### 10.5 未匹配 Archetype 变化

```text
Archetype.version++

Query 没有对应 QueryArchetypeEntry
    → 不检查
    → 不同步
    → 不产生任何额外工作
```

### 10.6 保留 Chunk 重新活动

```text
Archetype.insert()
    → 所需 chunkIdx 已小于 _chunks.length
    → 直接复用
    → Archetype.version 不变化

QueryIter.next()
    → 实时 chunkRowCount() 返回新行数
    → 不需要同步缓存
```

## 11. 复杂度

稳定状态：

```text
Query.iter()                         O(1)
进入一个已匹配 Archetype             O(1) 版本比较
遍历 Chunk                           O(Chunk 数)
遍历实体                              O(Entity 数)
```

新增 Archetype：

```text
O(新增 Archetype 数 × Query 条件匹配成本)
```

已有 Archetype Chunk 变化：

```text
O(被替换、增加或释放的连续尾部长度 + 1)
```

不会因为一个 Archetype 变化而扫描全部 Query，也不会因为一个未匹配 Archetype 变化而同步
不相关 Query。

## 12. 实施步骤

### 阶段 A：版本职责

1. 删除 World layoutVersion 状态和 getter。
2. 删除 Archetype 到 World 的布局变化 callback。
3. 从 `IArchetypeSource` 删除 `layoutVersion`。
4. 保证 `World.version` 只表达 Archetype 集合变化。
5. 保证 `Archetype.version` 只表达物理 Chunk 集合变化。

### 阶段 B：Query 惰性同步

1. 将 Query 同步拆分为 Archetype 集合同步和 Chunk 同步。
2. `Query.iter()` 只处理 World.version。
3. `QueryIter.next()` 在 `chunkIndex === 0` 时比较 Archetype.version。
4. 将 `synchronizeChunks/writeEntry/releaseEntry` 调整为 QueryIter 可调用的内部函数。
5. 从尾部按 EntitySet 身份寻找稳定公共前缀，覆盖 Chunk 数量不变但对象已经替换的情况。
6. 保持 QueryChunkEntry/current 高水位复用。

### 阶段 C：动态 Chunk 保留

1. 删除 `RETAIN_EMPTY_CHUNKS`。
2. 新增 `_spareChunkLimit = 0`。
3. 新增只读 getter 和带校验的 `setSpareChunkLimit()`。
4. 默认释放全部逻辑需求之外的物理 Chunk。
5. 降低保留值时立即回收多余 Chunk。
6. dispose 忽略保留值并释放全部 Chunk。

### 阶段 D：Game 策略

阶段 D 不属于本次 World P0 的完成条件，必须在阶段 A～C 冻结基线并由独立 benchmark
证明收益后另行实施：

1. 不新增默认自动策略；高级调用方可以直接使用 World 的显式设置机制。
2. 若后续实施，只跟踪迁移批次 touched Archetype。
3. 建立波动状态、策略自身变化隔离和硬上限。
4. 明确固定配置与自适应配置的独立来源，不能仅从 Archetype 当前数值猜测来源。
5. 为内存维护提供统一降为 0 的路径。
6. 只有 Game 拥有的默认 Allocator 可以由 Game 主动 `trim()`；外部 Allocator 不越权处理。

## 13. 测试计划

### 13.1 World 与 Archetype

- 新增 Archetype 会递增 World.version。
- Chunk push/pop 不改变 World.version。
- Chunk push/pop 会递增对应 Archetype.version。
- 普通行数变化且物理 Chunk 不变时，Archetype.version 不变化。
- 默认保留值为 0。
- 空 Archetype 的 `allocatedChunkCount` 和内部 `_chunks.length` 都为 0。
- `ArchetypeChunk.entities` 与实体稠密列是同一 TypedArray。
- `ArchetypeChunk.views` 中的字段列与对应稠密列是同一 TypedArray。
- 最后一个 Chunk 的 Buffer 会归还 Allocator。
- `setSpareChunkLimit(1)` 可以保留一个空 Chunk。
- 增大保留值不会主动分配 Chunk。
- 降低保留值会立即释放超额 Chunk。
- 非法保留值会抛出。
- dispose 后调用 `setSpareChunkLimit()` 会抛出。
- dispose 会忽略保留值并释放全部 Chunk。
- 自定义 Buffer 释放失败时，已经发生的 Chunk 集合变化仍会更新 Archetype.version。
- 批量释放局部失败时继续处理其余 Chunk，最终抛出第一个错误。

### 13.2 Query

- 稳定 `Query.iter()` 不读取 Archetype.version。
- 新增 Archetype 时只匹配新增区间。
- 进入匹配 Archetype 时只读取一次 version。
- 一个匹配 Archetype 新增 Chunk，只同步对应 Entry。
- 一个匹配 Archetype 释放 Chunk，只同步对应 Entry。
- 未匹配 Archetype 的 Chunk 变化不会访问 Query Entry。
- 保留空 Chunk 重新活动时不触发 Chunk 同步。
- 释放 Chunk 后 Query 清除旧 TypedArray 引用。
- Chunk 再次创建时复用原 QueryChunkEntry/current。
- Query 缓存 N 个 Chunk，Archetype 缩减后在 Query 再次进入前恢复到 N 个 Chunk 时，
  被替换尾部使用新的 TypedArray，旧 TypedArray 不再被 Query 引用。
- 纯增长和纯缩减只检查一次稳定公共前缀，不扫描未变化的全部 Chunk。
- World dispose 后 Query 能清除已经失效的 Archetype Entry。

### 13.3 Game 后续独立 candidate

- 只跟踪迁移批次触及的 Archetype。
- 持续边界振荡能把保留值从 0 提升到 1。
- 安静期能把保留值降回 0。
- 自适应值不会超过配置上限。
- 策略自身导致的 Chunk 释放不会再次增加 churn 分数。
- 场景清理会归零全部动态保留。
- Game 拥有的默认 Allocator 允许由 Game `trim()`。
- 外部 Allocator 不会被 Game 主动 `trim()`。
- 显式配置与自适应配置遵守最终确定的优先级。

## 14. Benchmark 计划

改造拆成两个独立 candidate，不把 Query 局部版本收益与 Chunk 回收策略收益混合归因。

### 14.1 Query 局部版本 candidate

正式比较时先使用保留旧“最多一个空 Chunk”策略的冻结 baseline，只比较全局
layoutVersion 与局部 Archetype.version 模型。除现有 Query 核心场景外，至少覆盖：

```text
无结构变化，少量匹配 Archetype
无结构变化，大量匹配 Archetype
每个 Archetype 一个 Chunk
每个 Archetype 多个 Chunk
未匹配 Archetype 高频 Chunk churn
一个匹配 Archetype Chunk churn
尾 Chunk 释放后在 Query 同步前恢复到相同数量
```

稳定场景用于测量 `QueryIter.next()` 每进入一个匹配 Archetype 时新增的版本读取和分支；
churn 场景用于证明局部失效不再唤醒不相关 Query。正常 JIT 与 `--jitless` 都必须纳入核心
门槛，不能只根据复杂度推导接受结果。

### 14.2 Chunk 保留策略 candidate

Query 局部版本 candidate 冻结后，再新增独立 Chunk 边界场景，避免与普通迁移吞吐混合：

```text
初始 count = chunkCapacity

反复执行：
    count → chunkCapacity + 1
    count → chunkCapacity
```

分别测试：

```text
spareChunkLimit = 0
spareChunkLimit = 1
```

Game 自适应 `0 → 1 → 0` 属于后续独立 candidate，不作为本次 World P0 的验收条件。

记录：

- Buffer alloc/release 次数；
- Table 创建次数；
- TypedArray view 创建次数；
- Archetype.version 变化次数；
- Query Chunk 同步次数；
- 每轮耗时；
- GC 次数和暂停；
- `allocatedBuffers/freeBuffers/reservedBytes`；
- 运行时实际 ArrayBuffer/heap 占用；
- 安静期结束后的最终内存占用。

Allocator 账面统计与实际 backing memory 必须分开报告。Query、Chunk 生命周期属于核心
热路径变更，candidate 按现有性能文档的 A/A 噪声带和 A/B 门槛执行；新增的诊断计数只用于
计时外 preflight，不能进入正式生产计时产物。

## 15. 已确认决策与延期项

依据架构宪法、公共 API 边界和性能规范，以下事项已经确认：

1. 公共名称使用 `spareChunkLimit` 和 `setSpareChunkLimit()`。
2. World 默认值为 0，只提供机制，不自动检测波动。
3. 本次不增加“立即释放全部 spare Chunk”便利入口，统一调用
   `setSpareChunkLimit(0)`。
4. Game 第一版不默认启用自适应；阶段 D 不属于本次 World P0 完成条件。
5. 所有 World 都可以归零动态保留值；只有 Game 拥有的默认 Allocator 可以由 Game
   主动 `trim()`。
6. 外部 Allocator 的裁剪由其所有者负责。

以下事项延期到 Game 自适应独立设计：

1. 默认波动阈值、安静期和每 Archetype 最大保留数。
2. 显式固定配置与自适应配置的存储方式和优先级。
3. Game 在哪些明确的维护或宿主生命周期事件中执行全局降级。
4. 自适应策略的独立 benchmark、启用条件和公共配置入口。
