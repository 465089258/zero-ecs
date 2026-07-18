import { Resource, Service, State } from "zero-ecs-lib";
import { GameConfig } from "../common/game-config";
import { GameViewResource } from "../common/game-view-resource";
import { GameState } from "../common/game-state";
import { MetricsService } from "../common/metrics-service";

export class RenderState extends State {
    @Resource.inject(GameViewResource) readonly view!: GameViewResource;
    @Resource.inject(GameConfig) readonly config!: GameConfig;
    @State.inject(GameState) readonly game!: GameState;
    @Service.inject(MetricsService) readonly metrics!: MetricsService;

    background: CanvasGradient | undefined;
}
