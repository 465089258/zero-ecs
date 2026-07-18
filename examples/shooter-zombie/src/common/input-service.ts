import { Resource, Service } from "zero-ecs-lib";
import { GameViewResource } from "./game-view-resource";

export class InputService extends Service {
    @Resource.inject(GameViewResource) private view!: GameViewResource;
    private _restartPending = false;
    private _upgradeChoice = -1;

    override init(): void {
        window.addEventListener("keydown", (e: KeyboardEvent) => {
            if (e.key === "r" || e.key === "R") this._restartPending = true;
            const idx = parseInt(e.key) - 1;
            if (idx >= 0 && idx <= 2) this._upgradeChoice = idx;
        });
        this.view.restartButton.addEventListener("click", () => { this._restartPending = true; });
    }
    consumeRestart(): boolean { if (!this._restartPending) return false; this._restartPending = false; return true; }
    consumeUpgrade(): number { const c = this._upgradeChoice; this._upgradeChoice = -1; return c; }
}
