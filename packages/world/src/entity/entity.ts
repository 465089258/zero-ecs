declare const EntityBrand: unique symbol;

/** 带版本号的实体句柄；实体回收后，旧句柄会自动失效。 */
export type Entity = number & { readonly [EntityBrand]: "Entity" };

/** 不指向任何实体的保留句柄。 */
export const INVALID_ENTITY = 0 as Entity;

/** 以数组方式访问的实体句柄集合。 */
export interface EntitySet extends ArrayLike<Entity> {
    [idx: number]: Entity;
}
