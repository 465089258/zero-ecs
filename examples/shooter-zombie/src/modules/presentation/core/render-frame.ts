import { Service, State, type Mut } from "@zero-ecs/game";

/** 每个宿主显示帧更新一次的短生命周期表现状态。 */
export class RenderFrameState extends State {
    now = 0;
    delta = 0;
    interpolation = 0;
    frameIndex = 0;
    startedAt = 0;
}

/** 宿主写入帧输入的窄入口。 */
export class RenderFrameService extends Service {
    @State.inject(RenderFrameState) private readonly state!: Mut<RenderFrameState>;

    begin(now: number, delta: number, interpolation: number): void {
        this.state.now = now;
        this.state.delta = delta;
        this.state.interpolation = Math.max(0, Math.min(1, interpolation));
        this.state.frameIndex++;
        this.state.startedAt = performance.now();
    }
}
