/** @internal 32 位实体句柄中的索引位数。 */
export const ENTITY_INDEX_BITS = 20;
/** @internal 32 位实体句柄中的版本位数。 */
export const ENTITY_VERSION_BITS = 12;
/** @internal 实体索引掩码。 */
export const ENTITY_INDEX_MASK = (1 << ENTITY_INDEX_BITS) - 1;
/** @internal 实体版本掩码。 */
export const ENTITY_VERSION_MASK = (1 << ENTITY_VERSION_BITS) - 1;

/** Game bridge 稀疏索引使用的句柄索引提取。 */
export function entityIndexOf(entity: number): number { return entity >>> ENTITY_VERSION_BITS; }
