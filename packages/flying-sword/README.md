# @zero-ecs/flying-sword

面向 Zero ECS Game 的可选飞剑领域扩展。包内只保存权威 3D 模拟数据：

- X：左右，正方向向右。
- Y：上下高度，地面通常为 `Y = 0`。
- Z：前后纵深，正方向为角色前方。

主入口提供飞剑控制组、飞剑运行时、只读查询视图和固定 Tick 系统。
`@zero-ecs/flying-sword/integration` 定义宿主空间数据适配接口。
`@zero-ecs/flying-sword/presentation` 提供与渲染后端无关的正交俯视投影和深度排序设施。

该包要求宿主安装 `CommandModule`、`TimeModule`，并为
`FlyingSwordSpatialService` 注册一个具体实现。
