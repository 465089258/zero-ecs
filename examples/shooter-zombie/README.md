# Shooter Zombie 模块化示例

这个示例的首要目标是展示可维护的 ECS 模块边界，而不只是把游戏运行起来。每个领域模块拥有自己的组件、查询、状态和系统；跨领域规则只能出现在集成层。

## 依赖方向

```text
                         ShooterZombieModule
                                  |
        +-------------------------+-------------------------+
        |                         |                         |
 SharedKernelModule          HostModule              PresentationModule
        ^                         ^                         |
        |                         |                         |
  +-----+--------------------------------------------------+
  |     |       |         |          |          |           |
Attribute  Damage  Projectile  Shooter  Zombie  Progression  Feedback
  ^     ^       ^         ^          ^          ^           ^
  +-----+-------+---------+----------+----------+-----------+
                            |
               GameplayIntegrationModule
```

箭头表示“被依赖”。叶子领域模块只允许依赖 `common` 共享内核，彼此之间不得直接导入。`GameplayIntegrationModule` 是唯一可以同时组合多个领域模块的规则层；`PresentationModule` 是最外层只读表现适配器；`ShooterZombieModule` 只负责组装。

## 模块职责

| 模块 | 独占内容 | 不应知道 |
| --- | --- | --- |
| `common` | 位置/速度等稳定共享类型、`GameSessionState`、调度集合、静态配置 | DOM、具体玩法模块、渲染 |
| `host` | Canvas/DOM 句柄、输入与性能采样适配器 | Zombie、Damage、Progression 等玩法 |
| `attribute` | 通用属性变化请求与应用 | 伤害来源和具体实体种类 |
| `damage` | 伤害请求到伤害结果的计算 | Projectile、Zombie、Health 的业务反应 |
| `projectile` | 投射物运动 | 命中后伤害和经验规则 |
| `shooter` | 射击意图 | 子弹创建、目标选择和成长 |
| `zombie` | 僵尸移动数据与行为 | 墙体伤害、掉落和计分 |
| `progression` | 经验收集、升级数据与升级算法 | DOM 输入、Shooter 重建 |
| `feedback` | 短时伤害文字 | Damage 的结算实现 |
| `integration` | 波次、生命周期、统计投影和所有跨模块规则 | Canvas 渲染实现 |
| `presentation` | 后端无关的绘制 System、Canvas/DOM 后端适配和 UI 投影 | 修改领域规则 |

## State 所有权

- `GameSessionState`：共享会话阶段，只保存 `mode` 与跨 Tick 门闩。
- `ProgressionState`：由 Progression 注册并独占成长数据。
- `WaveState`：由 Integration 独占波次编排数据。
- `GameplayStatisticsState`：由 Integration 写入，Presentation 只读展示。

不要把这些字段重新合并为一个全局 `GameState`。状态按变化原因和所有者拆分，能避免一个叶子模块为了读取单个字段而依赖其他领域。

## 跨模块协作范式

叶子模块表达意图或事实，集成层完成翻译：

```text
Shooter 产生 ShotRequest
  -> Integration 选择目标并创建 Projectile
  -> Integration 检测碰撞并创建 DamageRequest
  -> Damage 生成 DamageResult
  -> Integration 转成 AttributeChangeRequest
  -> Attribute 修改 Health
  -> Integration 处理死亡、经验、计分和反馈
```

调度只通过 `GameplaySet` 表达阶段协议。模块不得通过导入其他模块的具体 System 函数来制造顺序依赖。

## 热路径写法

查询返回列式数据后，先缓存列，再进入行循环：

```ts
const amounts = data[DamageRequest.amount];
const targets = data[DamageRequest.target];
for (let i = 0; i < count; i++) {
    const amount = amounts[i];
    const target = targets[i];
}
```

不要在循环中反复写 `data[DamageRequest.amount][i]`。示例代码也是性能用法的文档，不能为了少两行代码示范低效访问。

## 自动边界检查

`tests/examples/shooter-zombie-boundary.test.ts` 会扫描源码导入关系并强制执行：

- 叶子领域模块只能导入自身和 `common`；
- `common` 与 `host` 不能向外依赖；
- `integration` 不能依赖 `presentation`；
- 已移除的横切 `lifecycle` 模块不能重新出现。

新增功能时，如果两个叶子模块需要协作，请在 Integration 中增加适配 System，而不是让其中一个模块依赖另一个。

## 渲染边界

渲染使用宿主显式驱动的独立 `Render` 阶段，不注册到固定模拟的 `Update.last`：

```text
requestAnimationFrame
  ├─ Game.update() × 0..N
  ├─ RenderFrameService.begin(now, delta, interpolation)
  └─ Game.runStage(Render) × 1
```

各领域表现 System 只依赖抽象 `RenderService`，通过矩形、圆、线段和文字等后端无关
图元表达绘制意图。它们不能导入 `CanvasRenderingContext2D`、`GameViewResource` 或具体
后端。`CanvasRenderService extends RenderService` 是当前后端；未来可以替换成 WebGL
实现而不修改 Zombie、Projectile 等表现 System。

```text
ZombieRenderSystem ──┐
ProjectileRenderSystem ──> RenderService <── CanvasRenderService
ShooterRenderSystem ─┘                         WebGlRenderService（可选）
```

每个表现切片遵守：

- Resource 保存颜色、字体、尺寸等不变样式；
- State 只保存真正变化的表现状态，不能为凑齐结构而创建；
- System 查询实体并调用抽象渲染服务；
- 具体后端独占 Canvas/WebGL API、缓存和批处理策略；
- 不创建逐实体命令对象，图元 API 使用位置参数。
