import { BasicContainer } from "../container";
import { InjectionKeys } from "../injection/metadata";
import type { Resource } from "./types";

/** 保存构建期传入的只读依赖或能力，并在构建后锁定其注册关系。 */
export class ResourceContainer extends BasicContainer<Resource> {
    constructor() {
        super(InjectionKeys.resource);
    }
}
