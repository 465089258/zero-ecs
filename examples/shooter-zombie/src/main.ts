import {
    CommandModule,
    FixedTimeResource,
    GameBuilder,
    RandomModule,
    TimeModule,
} from "@zero-ecs/game";
import { createGameView } from "./app/create-game-view";
import { runGame } from "./app/game-runtime";
import { ShooterZombieModule } from "./modules";
import "./styles.css";

const FIXED_STEP = 1 / 120;
const view = createGameView();

const game = new GameBuilder()
    .addModule(new CommandModule())
    .addModule(new TimeModule(new FixedTimeResource(FIXED_STEP)))
    .addModule(new RandomModule())
    .addModule(new ShooterZombieModule(view))
    .build();

runGame(game, view, FIXED_STEP);
