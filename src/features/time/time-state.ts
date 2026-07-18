import { State } from "../../context";

/** 每次 `Ecs.update()` 精确推进一次的确定性模拟时间。 */
export class TimeState extends State {
    /** 当前 Tick 的固定时长，单位为秒。 */
    readonly delta: number = 0;
    /** 启动后累计的模拟时间，单位为秒。 */
    readonly elapsed: number = 0;
    /** 已执行的固定 Tick 数量。 */
    readonly tick: number = 0;
}
