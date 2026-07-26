import { Resource } from "@zero-ecs/game";

export class RogueRunTuning extends Resource {
    readonly seed: number;
    readonly initialEnemyTarget: number;
    readonly spawnRadius = 18;
    readonly despawnRadius = 46;
    readonly baseBudgetPerTick = 0.018;
    readonly budgetGrowthPerTick = 0.0000025;
    readonly maximumSpawnsPerTick = 6;
    readonly contactCooldownTicks = 45;
    readonly initialStamina = 100;
    readonly fusionStaminaDrainPerSecond = 40;
    readonly staminaRecoveryPerSecond = 22;
    readonly fusionRestartStamina = 25;
    readonly initialFormationRadius = 3.7;
    readonly initialFormationAngularSpeed = 0.92;

    constructor(search = window.location.search) {
        super();
        const parameters = new URLSearchParams(search);
        this.seed = readInteger(parameters, "seed", 12345, 1, 0xffffffff);
        this.initialEnemyTarget = readInteger(
            parameters,
            "enemies",
            24,
            0,
            2000,
        );
    }
}

function readInteger(
    parameters: URLSearchParams,
    name: string,
    fallback: number,
    minimum: number,
    maximum: number,
): number {
    const raw = parameters.get(name);
    if (raw === null) return fallback;
    const value = Number(raw);
    return Number.isSafeInteger(value) &&
        value >= minimum &&
        value <= maximum
        ? value
        : fallback;
}
