import { type IAllocator, type StructureWriter, World } from "@zero-ecs/world";
import { allocatorOfWorld, isWorldDisposed } from "@zero-ecs/world/game-bridge";

interface WorldClaim {
    readonly owner: symbol;
    finalized: boolean;
}

/** Game 包私有的 World 唯一占用表；World 内核不感知 Game。 */
const claims = new WeakMap<World, WorldClaim>();

export function claimWorld(world: World, owner: symbol): void {
    if (isWorldDisposed(world)) throw new Error("World has already been disposed");
    const claim = claims.get(world);
    if (claim && claim.owner !== owner) throw new Error("World belongs to another Game");
    if (!claim) claims.set(world, { owner, finalized: false });
}

export function finalizeWorld(world: World, owner: symbol): void {
    const claim = requireClaim(world, owner);
    if (claim.finalized) return;
    try { world.dispose(); }
    finally { claim.finalized = true; }
}

export function structureWriterOf(world: World, owner: symbol): StructureWriter {
    const claim = requireClaim(world, owner);
    if (claim.finalized || isWorldDisposed(world)) throw new Error("World has already been disposed");
    return world;
}

export function allocatorOf(world: World): IAllocator { return allocatorOfWorld(world); }

function requireClaim(world: World, owner: symbol): WorldClaim {
    const claim = claims.get(world);
    if (!claim || claim.owner !== owner) throw new Error("World belongs to another Game");
    return claim;
}
