import { Resource, Service } from "@zero-ecs/game";
import { GameViewResource } from "./resources";

/** 把 DOM 输入适配为 GameplayIntegration 可消费的窄方法。 */
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

    start(): void {
        window.addEventListener("keydown", this.keyDown);
        this.view.restartButton.addEventListener("click", this.requestRestart);
    }

    consumeRestart(): boolean {
        if (this.restartRequests === 0) return false;
        this.restartRequests--;
        return true;
    }

    consumeUpgrade(): number {
        if (this.upgradeChoice < 0) return -1;
        const choice = this.upgradeChoice;
        this.upgradeChoice = -1;
        return choice;
    }

    stop(): void {
        window.removeEventListener("keydown", this.keyDown);
        this.view.restartButton.removeEventListener("click", this.requestRestart);
    }
}

