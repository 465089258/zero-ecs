import { BasicContainer } from "../container";
import { createInjectDecorator } from "../injection-metadata";
import type { Resource, ResourceType } from "./types";

const ResourceSymbol = Symbol("ResourceMetadata");
/** 保存构建期传入的只读依赖或能力，并在构建后锁定其注册关系。 */
export class ResourceContainer extends BasicContainer<Resource> {
    constructor() {
        super(ResourceSymbol)
    }
    static inject<T extends Resource>(type: ResourceType<T>) {
        return createInjectDecorator(ResourceSymbol, type);
    }
}
