/** Internal 32-bit Entity handle layout shared by storage and sparse indexes. */
export const ENTITY_INDEX_BITS = 20;
export const ENTITY_VERSION_BITS = 12;
export const ENTITY_INDEX_MASK = (1 << ENTITY_INDEX_BITS) - 1;
export const ENTITY_VERSION_MASK = (1 << ENTITY_VERSION_BITS) - 1;
