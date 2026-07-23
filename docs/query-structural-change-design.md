# Query 结构变化查询设计

> 状态：方案已讨论，尚未实施。本文用于固定设计边界，后续实现必须先经过独立评审和性能验证。

## 1. 目标

在不破坏现有密集 Chunk Query 的前提下，让系统可以查询一个结构提交批次中实体组件集合的净变化，并支持与普通 Query 一致的声明语法：

```ts
const HealthLifecycleQuery = QueryType.from(
    All(
        Any(
            Added(HealthType),
            Removed(HealthType),
        ),
        With(PlayerType),
        Without(DisabledType),
    ),
);
```

设计必须满足：

- 对外仍然只有 `QueryType` 和 `QueryOf<T>`，不引入公开的 `ChangeQueryType` 或 `ChangeQueryOf`。
- `Added`、`Removed` 可以任意参与 `All`、`Any` 组合，不限制一个查询只能有一个变化触发器。
- `With`、`Without` 保持普通 Query 的最终结构语义。
- 可以显式查询变化前的结构，但不得根据 Added 或 Removed 隐式改变 `With`、`Without` 的时点。
- 未注册结构变化查询时，不为所有结构操作永久支付记录成本。
- 稳定高水位后不为单条结构变化创建对象。
- 内部运行时模式和判别值使用数值 `const enum`，不在热路径比较字符串。

## 2. 为什么不能直接复用当前密集遍历结果

当前普通 Query 按 Archetype Chunk 返回连续数据：

```ts
[count, entities, ...componentColumns]
```

它隐含 `0..count-1` 都是匹配行。结构变化查询则是稀疏的：

- 同一个 Chunk 中可能只有少量实体发生变化。
- Removed 发生后，被移除组件的列已经不可访问。
- despawn 后实体没有当前 Archetype 和 row。
- 复制组件列会失去原地写入语义。
- 保存旧 row 会暴露已经被 swap-remove 覆盖的位置。

因此声明类型可以统一，但内部执行计划和迭代结果必须诚实地区分。

普通密集 Query 继续返回：

```ts
[count, entities, ...componentColumns]
```

包含 `Added` 或 `Removed` 的结构变化 Query 第一版返回：

```ts
[count, entities]
```

在变化 Query 中，`With` 和 `Without` 只承担结构过滤，不返回组件列。需要读取提交后的当前字段时，系统额外取得 `World` 并使用 `get` 或 `has`。

## 3. 统一公共语法

### 3.1 多变化条件

```ts
// 同一提交批次同时添加 A 和 B。
const AddedBoth = QueryType.from(
    All(
        Added(AType),
        Added(BType),
    ),
);

// 添加 A 或移除 B。
const EitherChange = QueryType.from(
    Any(
        Added(AType),
        Removed(BType),
    ),
);

// B 被替换成 A。
const Replaced = QueryType.from(
    All(
        Added(AType),
        Removed(BType),
    ),
);
```

`Added` 和 `Removed` 可以接受多个组件，多个参数表示全部满足：

```ts
Added(AType, BType)
Removed(AType, BType)
```

任意一个满足必须显式使用 `Any`：

```ts
Any(
    Added(AType),
    Added(BType),
)
```

### 3.2 最终结构过滤

普通 `With`、`Without` 始终检查提交后的最终 Archetype：

```ts
const RemovedHealthFromLivingPlayer = QueryType.from(
    All(
        Removed(HealthType),
        With(PlayerType),
        Without(DeadType),
    ),
);
```

含义是：本批次移除了 `Health`，并且提交后实体仍拥有 `Player` 且不拥有 `Dead`。

如果实体已经 despawn，最终结构视为空结构，因此它不会匹配任何普通 `With`。

### 3.3 变化前结构过滤

查询旧结构必须显式使用 `Before`：

```ts
const RemovedPlayerHealth = QueryType.from(
    All(
        Removed(HealthType),
        Before(
            With(PlayerType),
            Without(PersistentType),
        ),
    ),
);
```

`Before` 内的 `With`、`Without` 检查提交前 Archetype。普通 `With`、`Without` 等价于 after/final 语义。未来可以提供 `After` 作为可读性别名，但它不是第一版必需能力。

第一版变化 Query 不接受 `Optional`。变化结果不返回组件列，`Optional` 没有稳定且有价值的结果语义；如未来设计稀疏组件 Join，应另行评审。

## 4. 净结构变化语义

结构变化以一个发布批次内每个实体的起始和最终结构为准，不暴露中间迁移。

例如：

```text
原始：[A]
命令 1：[A, B]
命令 2：[B, C]
最终：[B, C]
```

发布结果为：

```text
Added(B)   = true
Added(C)   = true
Removed(A) = true
```

如果最终回到原结构：

```text
[A] → [A, B] → [A]
```

则不发布任何净结构变化。

统一规则：

- spawn：before 为空，after 为新实体最终 Archetype。
- add/remove：before 为批次开始时 Archetype，after 为批次完成时 Archetype。
- despawn：before 为销毁前 Archetype，after 为空。
- `set` 不属于结构变化。
- 无效命令或没有产生最终结构差异的事务不发布记录。
- 同一实体在一个批次中最多发布一条净结构变化记录。

## 5. AST 判定语义

每条结构变化记录拥有 before 和 after 两个不可变 Archetype Mask。节点按以下规则计算：

```text
Added(A)   = before 不包含 A && after 包含 A
Removed(A) = before 包含 A && after 不包含 A

With(A)    = after 包含 A
Without(A) = after 不包含 A

Before(With(A))    = before 包含 A
Before(Without(A)) = before 不包含 A
```

`All`、`Any` 对这些布尔结果进行组合。这样 `Any(Added(A), Removed(B))` 不会产生过滤时点歧义。

## 6. 内部结构记录

支持任意 Added/Removed 组合后，记录单位应是实体事务，而不是按组件分别保存 Added/Removed 列表：

```ts
interface StructuralChangeRecord {
    readonly entity: Entity;
    readonly beforeArchetypeIdx: number;
    readonly afterArchetypeIdx: number;
}
```

实际实现使用复用的并行 TypedArray，而不是逐条创建对象：

```text
entities[]
beforeArchetypeIndices[]
afterArchetypeIndices[]
used
```

使用一个固定无效值表示不存在：

```ts
const NONE_ARCHETYPE = 0xFFFFFFFF;
```

Archetype ID 适合充当结构快照：

- ID 创建后保持稳定。
- 空 Archetype 不会从 ArchetypeStore 删除。
- Archetype Mask 不会改变。
- World dispose 前可以通过 ID 恢复 before/after Mask。

不记录 row：

- Added 实体的 row 可能在同一批次后续 swap-remove 中改变。
- Removed 的旧 row 已经失效。
- despawn 没有最终 row。
- AST 匹配只需要 Archetype Mask。

如果未来需要定位型 Added 高级 API，应在提交完成后从 EntitySlots 解析当前位置，并单独放入 advanced 路径，不得复用旧 row。

## 7. 按实体合并

World 的变化跟踪器需要使用 Entity 到记录下标的稀疏分页索引：

```text
第一次观察实体变化
→ 保存批次起始 beforeArchetypeIdx

后续再次变化
→ 只更新 afterArchetypeIdx

发布前 before == after
→ 丢弃净空变化
```

实现可以复用当前 `EntityPlanIndex` 的分页思路，但跟踪器属于 World 内核，不依赖 Game Commands、Service 或注入容器。

## 8. 按需记录

Query prepare/创建冷路径编译所有变化 Query 使用的 `Added/Removed` 组件，并合并成 World-local `observedStructuralChangeMask`。

结构提交时：

```text
没有结构变化 Query
→ 不建立变化记录

before/after 差异与 observed mask 无交集
→ 不记录该实体

存在交集
→ 写入或合并实体结构变化记录
```

第一版可以让每个变化 Query 扫描发布批次并使用查询本地高水位缓冲区保存匹配实体。查询缓存当前发布版本，同一版本重复 `iter()` 不重复编译或分配。只有 benchmark 证明扫描成为瓶颈后，才评审按组件建立二级索引。

## 9. 结构发布边界

World 不依赖 Game Tick，只提供结构变化发布能力。Game 在一个完整结构提交批次结束后调用一次：

```text
Update.post
  Commands flush
  EntityCommand 合并
  Structure apply
  publish structural changes
  后续 Post System / Event
```

发布后：

- 后续 Post System 可以按依赖顺序读取本批变化。
- 下一次 Update.first/fixed/last 仍读取同一份稳定变化。
- 下一次结构发布时替换上一份结果。
- 同一查询可以重复迭代，不采用消费即清空语义。

独立 World 的高级调用方必须在完成一批即时结构操作后显式发布。具体公开或 game-bridge API 名称在实施前评审；World 不引入 Game、Stage 或 Scheduler 概念。

## 10. 统一类型与内部计划

公共 `QueryType` 保存完整 AST，不暴露字符串或运行模式：

```ts
export class QueryType<
    Components extends QueryComponentTuple,
    Ast extends QueryTypeNode = QueryTypeNode,
> {
    constructor(readonly ast: Ast) {}

    static from<Ast extends QueryTypeNode>(
        ast: Ast,
    ): QueryType<QueryComponentsOf<Ast>, Ast> {
        return new QueryType(ast);
    }
}
```

`QueryOf<T>` 继续是唯一的运行时 Query 类型映射。类型层通过 AST 条件类型推导迭代结果；该判断不生成运行时代码。

内部运行计划使用数值 `const enum`：

```ts
/** @internal */
const enum QueryPlanKind {
    Dense = 0,
    StructuralChange = 1,
}

interface DenseQueryPlan {
    readonly kind: QueryPlanKind.Dense;
}

interface StructuralChangeQueryPlan {
    readonly kind: QueryPlanKind.StructuralChange;
}

type QueryPlan = DenseQueryPlan | StructuralChangeQueryPlan;
```

同类内部判别值也使用数值 `const enum`：

```ts
const enum StructuralChangeKind {
    Added = 0,
    Removed = 1,
}

const enum StructuralSnapshotKind {
    Before = 0,
    After = 1,
}
```

Query 创建冷路径只分析一次 AST：

```text
无 Added/Removed
→ DenseQueryPlan

包含 Added/Removed
→ StructuralChangeQueryPlan
```

运行期间只判断数值计划类型，不比较 `"dense"`、`"change"` 等字符串。

## 11. 不在本方案内的能力

以下内容暂不进入第一版：

- 字段 `Changed<T>`：TypedArray 直接写入无法在没有逐写包装的情况下可靠检测。
- Removed 组件字段快照：通用复制会增加提交成本和内存占用。
- 旧 row 访问：迁移后已经失效。
- 变化 Query 的可写组件列：稀疏复制无法保持原地写语义。
- 自动 before-remove 回调：会引入提交期回调、重入和异常语义。
- 按组件建立复杂二级变化索引：先以真实 benchmark 决定。

需要释放外部对象时，推荐把外部句柄保存在以 Entity 为键的模块私有表中，Removed 只需提供 Entity。如果清理必须读取被移除组件的旧字段，应另行设计显式 Command/Event 或受控的 before-remove observer。

## 12. 实施阶段与验收

### 阶段 Q1：AST 与类型

- 增加 `AddedNode`、`RemovedNode`、`BeforeNode`。
- 扩展 `QueryTypeNode`、`All`、`Any` 类型推导。
- 保持现有普通 Query 类型测试全部通过。
- 添加多 Added/Removed 组合的正向和负向类型测试。

### 阶段 Q2：World 变化记录

- 建立复用的实体结构变化记录缓冲区。
- 实现一个发布批次内按 Entity 合并。
- 正确覆盖 spawn、add、remove、组合替换和 despawn。
- 未注册变化查询时不得分配记录缓冲区。

### 阶段 Q3：查询执行计划

- 冷路径编译 Dense 或 StructuralChange 计划。
- 支持 `With`、`Without`、`All`、`Any`、`Before`。
- 同一发布版本重复迭代结果稳定。
- 发布下一批后旧结果失效且缓冲区复用。

### 阶段 Q4：Game 提交集成

- 在完整 EntityCommand 结构应用后发布一次。
- 固定 Post System 与下一 Tick 的可见性。
- 保持 Commands 同实体事务合并语义。

### 必须测试

- `All(Added(A), Added(B))`。
- `Any(Added(A), Removed(B))`。
- `All(Added(A), Removed(B))` 替换组件。
- `With/Without` 使用 after Mask。
- `Before(With/Without)` 使用 before Mask。
- spawn 的 Added。
- despawn 的 Removed。
- 同批 add 后 remove 不产生净变化。
- 同批 remove 后 add 回到原结构不产生净变化。
- 同一 Entity 多条命令只发布一条记录。
- 多个 System 和重复 `iter()` 读取同一结果。
- 无观察者时结构热路径不创建变化记录。
- 高水位稳定后正式计时路径无新增显式分配。

## 13. 最终决策摘要

```text
对外：
QueryType + QueryOf<T>
All / Any / With / Without / Added / Removed / Before

内部：
DenseQueryPlan
StructuralChangeQueryPlan
数值 const enum 判别

记录：
Entity
beforeArchetypeIdx
afterArchetypeIdx

语义：
Added/Removed 检查 before/after 净差异
With/Without 检查 after
Before(...) 检查 before
```

该设计保留当前普通 Query 的连续 Chunk 性能模型，同时为模块间结构变化订阅提供统一、可组合、按需启用的 Query 语法。
