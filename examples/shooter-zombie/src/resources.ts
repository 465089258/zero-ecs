import { Resource } from "zero-ecs-lib";

export class GameConfigResource extends Resource {
    readonly width = 960;
    readonly height = 640;

    /** Shooter position */
    readonly shooterX = 70;
    readonly shooterY = 320;

    /** Wall position */
    readonly wallX = 210;
    readonly wallY = 320;
    readonly wallHalfWidth = 12;
    readonly wallHalfHeight = 260;
    readonly wallInitialHp = 2000;

    /** Zombie spawn area */
    readonly zombieSpawnX = 920;
    readonly zombieSpawnYMin = 80;
    readonly zombieSpawnYMax = 560;
    readonly zombieBaseHp = 10;
    readonly zombieHpGrowth = 15;
    readonly zombieBaseSpeed = 20;
    readonly zombieSpeedGrowth = 4;
    readonly zombieBaseXp = 30;
    readonly zombieXpGrowth = 5;
    readonly zombieDamage = 5;
    readonly zombieRadius = 14;
    readonly zombieHalfWidth = 12;
    readonly zombieHalfHeight = 16;

    /** Wave config */
    readonly waveInterval = 60;
    readonly zombiePerWaveBase = 5;
    readonly zombiePerWaveGrowth = 2;
    readonly spawnDelayMin = 3.0;
    readonly spawnDelayMax = 5.0;

    /** Bullet config */
    readonly bulletRadius = 5;
    readonly bulletSpeed = 800;
    readonly bulletLifetime = 1.5;
    readonly bulletBaseDamage = 5;

    /** Shooter base stats */
    readonly shooterFireInterval = 2.0;
    readonly shooterMinFireInterval = 0.15;
    readonly shooterCritChance = 0.05;
    readonly shooterCritMult = 1.5;
    readonly shooterScatterBase = 1;
    readonly shooterSplitBase = 2;
    readonly shooterRicochetBase = 0;
    readonly shooterBurstBase = 1;

    /** Upgrade (all percentage-based) */
    readonly upgradeDamageGrowth = 0.15;
    readonly upgradeAttackSpeed = 0.15;
    readonly upgradeCritChanceBonus = 0.05;
    readonly upgradeCritDamageBonus = 0.15;
    readonly upgradeScatter = 1;
    readonly upgradeSplit = 1;
    readonly upgradeRicochet = 1;
    readonly upgradeBurst = 1;
    readonly upgradeFlatDamage = 8;
    readonly upgradeDamageMultiplier = 0.15;

    /** Wave stages */
    readonly bossWaveInterval = 5;  // every 5 waves is a boss wave
    readonly bossWaveMultiplier = 2; // 2x zombies in boss wave
    readonly baseZombieGrowth = 2;   // +2 base zombies after each boss wave

    /** XP / Level */
    readonly xpBase = 25;
    readonly xpGrowth = 25;
    readonly expOrbSpeed = 80;

    /** Limits */
    readonly maxBullets = 5000;
    readonly maxZombies = 80;
    readonly maxExpOrbs = 300;
}

export interface TelemetryElements {
    readonly fps: HTMLElement;
    readonly simMs: HTMLElement;
    readonly renderMs: HTMLElement;
    readonly entities: HTMLElement;
    readonly bullets: HTMLElement;
    readonly zombies: HTMLElement;
    readonly score: HTMLElement;
    readonly wave: HTMLElement;
    readonly level: HTMLElement;
    readonly xp: HTMLElement;
    readonly wallHp: HTMLElement;
    readonly message: HTMLElement;
    readonly messageTitle: HTMLElement;
    readonly messageCopy: HTMLElement;
}

export class GameViewResource extends Resource {
    readonly context: CanvasRenderingContext2D;

    constructor(
        readonly canvas: HTMLCanvasElement,
        readonly restartButton: HTMLButtonElement,
        readonly upgradeContainer: HTMLElement,
        readonly upgradeSlots: readonly [HTMLElement, HTMLElement, HTMLElement],
        readonly telemetry: TelemetryElements,
    ) {
        super();
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("Canvas 2D is not available");
        this.context = context;
    }
}
