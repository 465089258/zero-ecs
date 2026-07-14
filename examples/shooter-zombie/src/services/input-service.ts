import { Resource, Service } from "zero-ecs-lib";
import { GameViewResource } from "../resources";
import { UpgradeType } from "../states";

export class InputService extends Service {
    @Resource.inject(GameViewResource) private readonly view!: GameViewResource;

    private restartRequests = 0;
    private upgradeChoice = -1;

    private readonly keyDown = (event: KeyboardEvent): void => {
        if (event.code === "KeyR") this.restartRequests++;
        if (event.code === "Digit1" || event.code === "Numpad1") this.upgradeChoice = 0;
        if (event.code === "Digit2" || event.code === "Numpad2") this.upgradeChoice = 1;
        if (event.code === "Digit3" || event.code === "Numpad3") this.upgradeChoice = 2;
    };
    private readonly requestRestart = (): void => { this.restartRequests++; };

    init(): void {
        window.addEventListener("keydown", this.keyDown);
        this.view.restartButton.addEventListener("click", this.requestRestart);
    }

    consumeRestart(): boolean { return this.consume("restartRequests"); }
    consumeUpgrade(): number {
        if (this.upgradeChoice < 0) return -1;
        const choice = this.upgradeChoice;
        this.upgradeChoice = -1;
        return choice;
    }

    dispose(): void {
        window.removeEventListener("keydown", this.keyDown);
        this.view.restartButton.removeEventListener("click", this.requestRestart);
    }

    private consume(field: "restartRequests"): boolean {
        if (this[field] === 0) return false;
        this[field]--;
        return true;
    }
}
