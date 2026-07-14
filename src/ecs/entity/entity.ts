declare const EntityBrand: unique symbol;

/** Generational ECS entity identifier. */
export type Entity = number & { readonly [EntityBrand]: "Entity" };

export interface EntitySet extends ArrayLike<Entity> {
    [idx: number]: Entity;
}


