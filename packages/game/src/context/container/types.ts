
export type AbsClassType<T> = abstract new (...args: any[]) => T;
export type ClassType<T> = new (...args: any[]) => T;