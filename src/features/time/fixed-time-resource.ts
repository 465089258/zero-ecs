import { Resource } from "../../context/types";

/** 构建前提供的不可变固定步长配置。 */
export class FixedTimeResource extends Resource {
    /** 创建固定步长配置，单位为秒。 */
    constructor(readonly deltaSeconds = 0.02) {
        super();
        if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
            throw new RangeError(`Fixed delta must be a finite positive number, received ${deltaSeconds}`);
        }
    }
}
