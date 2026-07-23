# @zero-ecs/scheduler

通用静态调度器。参数描述对 Scheduler 完全不透明，由调用方的
`SystemParamProvider` 在 `prepare()` 冷路径解析一次。
Scheduler 随后把解析结果编译为按 Stage 保存的固定 runner；`run()` 不再解析参数或判断
参数数量。

```ts
import { ScheduleBuilder, Scheduler, Stage } from "@zero-ecs/scheduler";

const update = new Stage("update", 0);
const schedule = new ScheduleBuilder<string>();
schedule.addSystem(update, value => console.log(value), ["message"]);
const scheduler = new Scheduler(schedule.build());
scheduler.init();
scheduler.prepare({ resolve: () => "hello" });
scheduler.run(update);
```
