import {
    Commands,
    Inject,
    Service,
} from "@zero-ecs/game";
import { DemoViewResource } from "./resources";
import {
    ChooseUpgradeRequest,
    ChooseUpgradeRequestType,
} from "../simulation/rogue/components";

/** 主循环与升级选择之间的窄暂停边界。 */
export class RogueRunControlService extends Service {
    @Inject.service(Commands) private readonly commands!: Commands;
    @Inject.resource(DemoViewResource)
    private readonly view!: DemoViewResource;

    private pausedValue = false;

    get paused(): boolean { return this.pausedValue; }

    private readonly chooseFirst = (): void => this.choose(0);
    private readonly chooseSecond = (): void => this.choose(1);
    private readonly chooseThird = (): void => this.choose(2);

    private readonly onKeyDown = (event: KeyboardEvent): void => {
        if (!this.pausedValue) return;
        if (event.code === "Digit1") this.choose(0);
        else if (event.code === "Digit2") this.choose(1);
        else if (event.code === "Digit3") this.choose(2);
        else return;
        event.preventDefault();
    };

    start(): void {
        const buttons = this.view.upgradeButtons;
        buttons[0].addEventListener("click", this.chooseFirst);
        buttons[1].addEventListener("click", this.chooseSecond);
        buttons[2].addEventListener("click", this.chooseThird);
        window.addEventListener("keydown", this.onKeyDown);
    }

    stop(): void {
        const buttons = this.view.upgradeButtons;
        buttons[0].removeEventListener("click", this.chooseFirst);
        buttons[1].removeEventListener("click", this.chooseSecond);
        buttons[2].removeEventListener("click", this.chooseThird);
        window.removeEventListener("keydown", this.onKeyDown);
        this.pausedValue = false;
    }

    pauseForUpgrade(): void {
        this.pausedValue = true;
    }

    private choose(slot: number): void {
        if (!this.pausedValue) return;
        this.commands
            .spawn()
            .add(ChooseUpgradeRequestType)
            .set(
                ChooseUpgradeRequestType,
                ChooseUpgradeRequest.Slot,
                slot,
            )
            .submit();
        // 选择请求需要至少推进一次固定 Tick 才能提交并被消费。
        this.pausedValue = false;
    }
}
