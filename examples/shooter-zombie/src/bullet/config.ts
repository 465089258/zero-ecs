import { Resource } from "zero-ecs-lib";

export class BulletConfig extends Resource {
    readonly speed = 800;
    readonly radius = 5;
    readonly lifetime = 1.5;
}
