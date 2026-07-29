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
    readonly initialLifeRegenerationPerSecond = 0.75;
    readonly initialLifeLeechDamageRatio = 0.01;
    readonly lifeLeechMaximumPerHitRatio = 0.05;
    readonly lifeLeechMaximumStoredRatio = 0.4;
    readonly lifeLeechReleaseDuration = 3.33;
    readonly lifeLeechMaximumRecoveryPerSecondRatio = 0.12;
    readonly initialStamina = 100;
    readonly fusionStaminaDrainPerSecond = 40;
    readonly staminaRecoveryPerSecond = 22;
    readonly fusionRestartStamina = 25;
    readonly initialMana = 100;
    readonly manaRecoveryPerSecond = 14;
    readonly formationManaBaseDrainPerSecond = 3;
    readonly formationManaDrainPerSwordPerSecond = 1.4;
    readonly formationManaRestartThreshold = 25;
    readonly initialSwordContainerCapacity = 12;
    readonly initialSpiritualSense = 4;
    readonly initialFormationRadius = 3.7;
    readonly initialFormationAngularSpeed = 0.92;
    readonly focusMinimumDistance = 5;
    readonly focusMaximumDistance = 14;
    readonly focusMinimumMana = 25;
    readonly focusManaDamageScale = 100;
    readonly fusionGatherTicks = 18;

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
