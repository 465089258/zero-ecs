import {
    Commands,
    INVALID_ENTITY,
    Inject,
    Service,
    type Entity,
} from "@zero-ecs/game";
import { DemoViewResource } from "./resources";
import {
    ChooseUpgradeRequest,
    ChooseUpgradeRequestType,
    ReplaceSwordRequest,
    ReplaceSwordRequestType,
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
    private readonly cancelReplacement = (): void =>
        this.chooseReplacement(INVALID_ENTITY);
    private readonly onReplacementClick = (event: Event): void => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const button = target.closest<HTMLButtonElement>(
            "button[data-outgoing]",
        );
        if (!button) return;
        const outgoing = Number(button.dataset.outgoing);
        if (!Number.isSafeInteger(outgoing)) return;
        this.chooseReplacement(outgoing as Entity);
    };

    private readonly onKeyDown = (event: KeyboardEvent): void => {
        if (!this.pausedValue) return;
        if (!this.view.swordReplacementPanel.hidden) {
            if (event.code === "Escape") {
                this.chooseReplacement(INVALID_ENTITY);
                event.preventDefault();
                return;
            }
            if (!event.code.startsWith("Digit")) return;
            const index = Number(event.code.slice(5)) - 1;
            const buttons =
                this.view.swordReplacementOptions.querySelectorAll<
                    HTMLButtonElement
                >("button[data-outgoing]");
            if (index < 0 || index >= buttons.length) return;
            buttons[index].click();
            event.preventDefault();
            return;
        }
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
        this.view.swordReplacementOptions.addEventListener(
            "click",
            this.onReplacementClick,
        );
        this.view.swordReplacementCancel.addEventListener(
            "click",
            this.cancelReplacement,
        );
        window.addEventListener("keydown", this.onKeyDown);
    }

    stop(): void {
        const buttons = this.view.upgradeButtons;
        buttons[0].removeEventListener("click", this.chooseFirst);
        buttons[1].removeEventListener("click", this.chooseSecond);
        buttons[2].removeEventListener("click", this.chooseThird);
        this.view.swordReplacementOptions.removeEventListener(
            "click",
            this.onReplacementClick,
        );
        this.view.swordReplacementCancel.removeEventListener(
            "click",
            this.cancelReplacement,
        );
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

    private chooseReplacement(outgoing: Entity): void {
        if (
            !this.pausedValue ||
            this.view.swordReplacementPanel.hidden
        ) return;
        const offerValue = Number(
            this.view.swordReplacementPanel.dataset.offer,
        );
        if (!Number.isSafeInteger(offerValue)) return;
        const offer = offerValue as Entity;
        this.commands
            .spawn()
            .add(ReplaceSwordRequestType)
            .set(
                ReplaceSwordRequestType,
                ReplaceSwordRequest.Offer,
                offer,
            )
            .set(
                ReplaceSwordRequestType,
                ReplaceSwordRequest.Outgoing,
                outgoing,
            )
            .submit();
        // 请求需要推进一次固定 Tick；等待动作退役时游戏继续运行。
        this.pausedValue = false;
    }
}
