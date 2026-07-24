/** 可由 Query 只读列或 TypedArray 满足的数值列。 */
export interface ReadonlyNumberColumn extends ArrayLike<number> {
    readonly [index: number]: number;
}
