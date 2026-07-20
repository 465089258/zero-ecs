import { State } from "@zero-ecs/game";

export const enum GameMode { Playing, Won, GameOver }

export class GameState extends State {
    score = 0;
    lives = 3;
    balls = 0;
    bricks = 0;
    drops = 0;
    entities = 0;
    collisions = 0;
    splits = 0;
    mode = GameMode.Playing;
    skipTick = 0;
}
