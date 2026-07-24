# @zero-ecs/motion

面向 Zero ECS 的通用运动扩展。包内只定义领域无关的运动输入和批量积分 System；位置、
速度、方向等通用数值事实来自 `@zero-ecs/math`。

`MoveTowards3Type` 表示调用方已经归并完成的目标追踪输入。Motion 不知道输入来自角色、
飞剑、投射物、AI、技能或属性系统。

使用 `Motion3Module` 时，移动实体需要持有 `Position3Type`、
`PreviousPosition3Type`、`Velocity3Type`、`Direction3Type` 和
`MoveTowards3Type`。系统在 `Update.fixed` 的 `MotionSystemSet.Integrate3` 中批量
更新上一帧位置、速度、权威位置和方向；逐实体循环不创建临时向量或结果对象。
