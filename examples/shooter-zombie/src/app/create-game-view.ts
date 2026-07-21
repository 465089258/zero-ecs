import { GameViewResource, type TelemetryElements } from "../modules/host";

export function createGameView(): GameViewResource {
    const telemetry: TelemetryElements = {
        fps: element("fps", HTMLElement),
        simMs: element("sim-ms", HTMLElement),
        renderMs: element("render-ms", HTMLElement),
        entities: element("entities", HTMLElement),
        bullets: element("bullets", HTMLElement),
        zombies: element("zombies", HTMLElement),
        score: element("score", HTMLElement),
        wave: element("wave", HTMLElement),
        level: element("level", HTMLElement),
        xp: element("xp", HTMLElement),
        wallHp: element("wall-hp", HTMLElement),
        message: element("message", HTMLElement),
        messageTitle: element("message-title", HTMLElement),
        messageCopy: element("message-copy", HTMLElement),
    };

    return new GameViewResource(
        element("game", HTMLCanvasElement),
        element("restart", HTMLButtonElement),
        element("upgrade-panel", HTMLElement),
        [
            element("upgrade-0", HTMLElement),
            element("upgrade-1", HTMLElement),
            element("upgrade-2", HTMLElement),
        ],
        telemetry,
    );
}

function element<T extends HTMLElement>(id: string, type: { new(): T }): T {
    const value = document.getElementById(id);
    if (!(value instanceof type)) throw new Error(`Missing ${type.name}#${id}`);
    return value;
}
