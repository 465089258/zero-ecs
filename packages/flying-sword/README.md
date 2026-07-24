# @zero-ecs/flying-sword

面向 Zero ECS Game 的可选飞剑领域扩展。包内只保存权威 3D 模拟数据：

- X：左右，正方向向右。
- Y：上下高度，地面通常为 `Y = 0`。
- Z：前后纵深，正方向为角色前方。

主入口提供飞剑控制组、飞剑运行时、只读查询视图、固定 Tick 系统，以及数字化飞剑技能
计划和 `FlyingSwordSkillService`。内置的“御剑诀·穿云”会聚剑、分波贯穿目标并自动
返回控制组槽位。
`@zero-ecs/flying-sword/integration` 定义宿主空间数据适配接口。

飞剑库不定义相机、视口、2D 投影、屏幕坐标、深度渲染队列或 Canvas 能力。表现层通过
`FlyingSwordQuery` 读取公开的 3D 数据，并在宿主或示例中自行完成裁剪、投影、排序和绘制。

该包要求宿主安装 `CommandModule`、`TimeModule`，并为
`FlyingSwordSpatialService` 注册一个具体实现。
