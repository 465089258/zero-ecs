/** @internal 仅供 GameBuilder 私有构造路径持有的 Game 创建凭证。 */
export const GAME_CONSTRUCTION_TOKEN = Symbol("GameConstructionToken");

/** @deprecated 使用内部 `GAME_CONSTRUCTION_TOKEN`。 */
export const ECS_CONSTRUCTION_TOKEN = GAME_CONSTRUCTION_TOKEN;
