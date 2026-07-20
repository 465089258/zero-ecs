/** @internal EntityCommand 指令操作码。 */
export const enum EntityInstruction {
    Add = 1,
    Remove = 2,
    Set = 3,
}

/** @internal 每条实体指令占用的数字槽位数量。 */
export const ENTITY_INSTRUCTION_SIZE = 4;
