# @zero-ecs/math

面向 Zero ECS 的 2D/3D 数学组件与无逐项分配运算。

```ts
import {
    Float3,
    Position3Type,
    Velocity3Type,
} from "@zero-ecs/math/3d";

import {
    OrthographicCameraType,
    Projected2Type,
    orthographicProjectionSystem,
} from "@zero-ecs/math/projection";
```

公共字段使用普通连续数字枚举；持久数学数据使用 ECS ComponentType。热路径进入 Chunk
后应先取得所需 TypedArray 列，逐行循环不得创建临时向量、矩阵或数组。

`projection` 子入口提供 ECS 相机、相机世界 AABB、投影包围半径和永久投影结果组件。
默认 Projection System 在 `Update.last` 执行；自定义表现阶段使用
`defineOrthographicProjectionSystem(stage)`。裁剪顺序为世界 AABB 粗裁剪、相机空间
正交视体精裁剪、可见实体投影。视野外实体只把 `Projected2.Visible` 写为 0，不删除组件，
也不覆盖最近一次有效的 X/Y/Depth。
