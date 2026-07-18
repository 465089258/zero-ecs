# zero-ecs-lib 状态与行为开发规范

本文定义底层运行时、内置 Feature 与第三方 Module 共同遵守的所有权和执行边界。新代码必须先确定数据属于 Resource、State 还是运行时局部值，再决定由 Service 或 System 提供行为。

## 1. 四类核心职责

| 类型 | 职责 | 生命周期特征 | 典型内容 |
| --- | --- | --- | --- |
| Resource | 构建时提供、运行期不替换的只读依赖或能力 | 注册关系在构建后锁定 | 固定步长、容量配置、DOM、Canvas、设备句柄 |
| State | 当前 ECS 实例拥有的可变模拟数据 | 随 Tick 演进 | 时间、随机机状态、实体槽、队列、派生索引 |
| Service | 操作、查询、算法与运行时能力入口 | 与当前 World 同生命周期 | `spawn()`、`once()`、`event()`、对象池 |
| System | 由 Stage/Tick 驱动的行为 | 由 Stage 调用 | 时间推进、命令提交、迁移、事件分发 |

State 与“将来需要序列化的数据”不是同义词。State 可以保存权威数据、派生索引和瞬态队列；未来只有显式标记的字段进入快照，未标记字段仍然属于 State。

## 2. State 规则

1. 属于世界模拟、会随运行演进并影响确定性结果的数据，原则上由 State 持有。
2. State 字段默认声明为 `readonly`，写入方通过 `Write(StateType)` 获得 `Mut<State>` 视图；数组、Map、TypedArray 等容器可以原地复用。
3. State 不提供业务操作方法，不为字段编写逐项 setter。复杂行为属于 Service、System 或其文件内私有函数。
4. State 可以包含与权威数据共享一致性边界的派生索引；是否持久化由未来的序列化元数据决定，而不是由 State 身份决定。
5. 空闲对象池属于运行时性能设施，统一由 Service 持有，不放入 State。State 中可以保存仍在等待执行、因而会影响未来结果的池化对象引用。
6. 内部 State 默认不从稳定包入口导出。外部系统不需要直接操作的状态应保持实现私有。

允许的例外是 DataSet、Allocator 等底层数据结构自身的方法；这些方法是数据结构原语，不是 World 业务行为。

## 3. Service 规则

1. Service 是行为与运行时能力容器，通常围绕 State 提供操作，类似 Rust 的 `impl`，但不要求每个 Service 都存在配套 State。
2. Service 不应保存随 World 演进的权威模拟状态；运行时策略、宿主回调、外部句柄、对象池和不参与快照的实现字段可以保留在 Service。
3. 面向调用者主动发起的操作可以保留为 Service 方法，例如 `EntityService.spawn()`、`TimerService.once()` 和 `EventService.on()`。
4. `init(context)` 只初始化自身并可读取 Resource/State；`activate(context)` 在全部 Service 完成 init 后建立跨 Service 连接；`start()/stop()` 只管理宿主事件、Worker 等外部输入；`dispose()` 释放内部结构。
5. `update()`、`advance()`、`flush()`、`tick()` 等由调度时序决定的入口必须实现为 System。System 不应只是对同名 Service 方法的转发。
6. 字段应按语义判断，而不是机械迁移：例如 `ErrorHandlerService.handler` 是运行时错误策略，`InjectionService` 的 context 是容器绑定，它们都不是 World 模拟状态。
7. 生命周期 Context 是一次性受限视图，hook 返回后立即失效。不得暴露或保存原始 `InjectionContext`；长期依赖仍使用属性注入，init-only 能力可在 activate 中解析并保存窄句柄。

## 4. System 规则

System 使用 `defSystem()` 将 Stage、运行函数和参数元数据绑定在同一文件：

```ts
export const advanceExampleSystem = defSystem(Update.fixed, advanceExample, [
    ExampleResource,
    TimeState,
    Write(ExampleState),
    ErrorHandlerService,
]);

function advanceExample(
    config: Readonly<ExampleResource>,
    clock: Readonly<TimeState>,
    state: Mut<ExampleState>,
    errors: ErrorHandlerService,
): void {
    // 直接执行本阶段逻辑
}

builder.addSystem(advanceExampleSystem);
```

规则如下：

1. 只读 State 使用 State 类型参数；写 State 必须使用 `Write(StateType)`。
2. Stage 驱动逻辑直接写在 System 或文件内私有函数中，不藏回 Service。
3. 私有辅助函数显式接收数据和能力，不自行定位全局上下文。
4. 内部 Post System 与公开 System 遵守相同规则。
5. Service API 若间接修改 State，必须在未来的 Service 访问元数据中声明；在该权限展开机制完成前，不得假设使用 Service 的系统是可并行的。
6. Module 只注册 `DefinedSystem`，不得再次声明 Stage 和参数；普通函数不能直接传给 `addSystem()`。
7. `SystemAccess` 是供排序、冲突分析和未来并行规划使用的调度元数据，不是安全边界。普通 State 参数的 `Readonly<T>` 只是浅只读类型，数组、Map、TypedArray 和嵌套对象不会被运行时隔离。

## 5. Resource 规则

1. Resource 在 `EcsBuilder.build()` 前由调用者创建并注册，构建完成后不能替换注册实例。
2. Resource 可以是静态配置，也可以是 DOM、Canvas、设备句柄等构建期提供的宿主能力。
3. “只读”表示 ECS 只提供浅只读引用且不替换实例，不保证引用指向的宿主对象不可变。
4. Resource 不用于保存计数器、队列或可恢复进度；配置一旦需要随 Tick 改变，应拆为固定 Resource 与动态 State。

## 6. Module 与开放封闭原则

Module 是功能安装和组合边界：

```ts
export class ExampleModule implements Module {
    build(builder: EcsBuilder): void {
        builder.addState(ExampleState);
        builder.addService(ExampleService);
        builder.addSystem(exampleSystem);
    }
}
```

“代码中存在”不代表“属于公共 API”。遵守以下导出规则：

1. 内部 State、具体实现 Service、内部 System 和辅助数据结构默认不从根入口导出。
2. 外部只需启用功能时，仅导出 Module。
3. 外部确需交互时，导出最小能力契约和稳定运行时 token；具体实现仍保持包内私有。
4. 不允许外部依赖 `dist` 内部路径；`package.json` 的 exports 是唯一受支持边界。
5. 新增实现优先扩展 Module 或替换包内实现，不扩大稳定入口。

这种边界允许内部继续拆 State、调整缓存和替换算法，而不破坏使用 Module 的应用。

## 7. 例外审批

Service 可以为了运行时策略、性能、内存布局或宿主集成保存局部字段。评审时应确认：

- 字段不是 World 的权威模拟状态；
- 字段不需要进入未来快照，或可在恢复后安全重建；对象池统一属于此类 Service 字段；
- 字段不需要参与 System 的 State 读写冲突分析；
- 字段不会让 SystemAccess 遗漏本应显式声明的 State 访问。

“写起来方便”本身不是例外理由。

## 8. 评审清单

- 新增可变字段是否影响世界确定性、快照或调度访问分析；如果是，是否位于 State？
- Service 中的字段是否确实属于运行时策略、宿主能力或实现细节？
- 每 Tick 行为是否直接注册为 System？
- System 是否准确声明全部 State 读写？
- Resource 是否确实在构建期提供且运行期不替换？动态进度是否错误地放进 Resource？
- 内部实现类是否意外进入根导出？
- State 中的派生缓存是否能由权威数据重建？
- 新代码是否为未来显式字段序列化保留了稳定边界？
