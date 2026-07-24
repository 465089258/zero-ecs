import {
    Inject,
    Service,
    State,
    type Mut,
} from "@zero-ecs/game";

export class DemoRenderFrameState extends State {
    interpolation = 0;
    frame = 0;
}

export class DemoRenderFrameService extends Service {
    @Inject.state(DemoRenderFrameState) private readonly state!: Mut<DemoRenderFrameState>;

    begin(interpolation: number): void {
        this.state.interpolation = Math.max(0, Math.min(1, interpolation));
        this.state.frame++;
    }
}
