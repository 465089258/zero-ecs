/** 表现层可复用的三维坐标输出，避免热路径创建临时对象。 */
export interface Vector3Out {
    x: number;
    y: number;
    z: number;
}
