/** 在 prepare 冷路径把不透明参数描述解析为固定运行时值。 */
export interface SystemParamProvider<Param = unknown> {
    resolve(param: Param): unknown;
}
