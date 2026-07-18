import {
    CommandModule,
    EcsBuilder,
    FixedTimeResource,
    RandomModule,
    TimeModule,
} from "zero-ecs-lib";
import { createGameView } from "./app/create-game-view";
import { runGame } from "./app/game-runtime";
import { ShooterZombieModule } from "./modules";
import "./styles.css";

const FIXED_STEP = 1 / 120;
const view = createGameView();

const ecs = new EcsBuilder()
    .addModule(new CommandModule())
    .addModule(new TimeModule(new FixedTimeResource(FIXED_STEP)))
    .addModule(new RandomModule())
    .addModule(new ShooterZombieModule(view))
    .build();

runGame(ecs, view, FIXED_STEP);
