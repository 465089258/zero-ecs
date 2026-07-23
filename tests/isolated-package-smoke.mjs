import { Allocator, World } from "@zero-ecs/world";
import { Stage } from "@zero-ecs/scheduler";
import {
    GameBuilder,
    Stage as GameStage,
    World as GameWorld,
} from "@zero-ecs/game";

if (World !== GameWorld || Stage !== GameStage) {
    throw new Error("Game loaded a duplicate World or Stage identity");
}

const allocator = new Allocator();
const world = new World(allocator);
const entity = world.spawn();
if (!world.valid(entity)) throw new Error("Standalone World install failed");
world.dispose();
allocator.clear();

const game = new GameBuilder().build();
game.dispose();
