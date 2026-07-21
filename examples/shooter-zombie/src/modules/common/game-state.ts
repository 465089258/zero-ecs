import { State } from "@zero-ecs/game";

export enum GameMode { Playing, LevelUp, GameOver }

/** 所有叶子玩法模块共享的最小会话协议。 */
export class GameSessionState extends State {
    mode = GameMode.Playing;
    skipTick = 0;
}
