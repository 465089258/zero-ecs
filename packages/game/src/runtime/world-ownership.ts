import { type IAllocator, World } from "@zero-ecs/world";

interface WorldClaim {
    readonly owner: symbol;
    finalized: boolean;
}

/** Game 包私有的 World 唯一占用表；World 内核不感知 Game。 */
const claims = new WeakMap<World, WorldClaim>();

export function claimWorld(world: World, owner: symbol): void {
    if (world.disposed) throw new Error("World has already been disposed");
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

export function allocatorOf(world: World): IAllocator { return world.allocator; }

function requireClaim(world: World, owner: symbol): WorldClaim {
    const claim = claims.get(world);
    if (!claim || claim.owner !== owner) throw new Error("World belongs to another Game");
    return claim;
}
