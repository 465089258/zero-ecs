# @zero-ecs/flying-sword

面向 Zero ECS Game 的可选飞剑领域扩展。包内只保存权威 3D 模拟数据：

- X：左右，正方向向右。
- Y：上下高度，地面通常为 `Y = 0`。
- Z：前后纵深，正方向为角色前方。

主入口提供飞剑控制组、飞剑运行时、只读查询视图、固定 Tick 系统，以及数字化飞剑技能
计划和 `FlyingSwordSkillService`。内置的“御剑诀·穿云”会先在角色周围聚剑，再
沿连续上升弧线分波转向、俯冲贯穿目标并自动返回控制组槽位。

飞剑库不定义相机、视口、2D 投影、屏幕坐标、深度渲染队列或 Canvas 能力。表现层通过
`FlyingSwordQuery` 读取公开的 3D 数据，并在宿主或示例中自行完成裁剪、投影、排序和绘制。

该包复用 `@zero-ecs/math/3d` 的位置、历史位置、速度和方向组件，并把最终追踪目标写入
`@zero-ecs/motion/3d` 的 `MoveTowards3Type`。宿主需要安装 `CommandModule`、
`TimeModule` 和 `Motion3Module`，并在固定 Tick 中通过 `FlyingSwordService.setCenter`
同步控制组中心。

飞剑的成员身份、基础飞行参数、编队目标、技能动作和接触窗口使用独立组件。技能动作与
接触窗口只在对应生命周期内通过 `Commands` 添加和移除；视觉素材编号属于宿主内容层，
不进入飞剑包。

控制组本身由身份、中心、基础目标、编队参数和控制状态五类组件组成。`focus`、
`setCenter`、`orbit`、`recall`、`cast` 和 `cancel` 都生成一次性 Request Entity：
命令在 `Update.post` 提交，请求在下一固定 Tick 消费。控制组级技能动作也是独立
Entity；State 只保存固定帧派生的紧凑索引和零分配 scratch，不承载请求或动作权威数据。
