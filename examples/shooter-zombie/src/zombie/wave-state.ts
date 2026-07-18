import { State } from "zero-ecs-lib";
import { WavePhase } from "../common/game-state";
export class WaveState extends State {
    wave = 0; waveBudget = 0; wavePhase = WavePhase.Spawning;
    restTimer = 0; isBossWave = false;
    spawnTimer = 0; baseZombieCount = 1;
}
