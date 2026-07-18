import type { QueryOf } from "zero-ecs-lib";
import { ShooterQuery } from "./query";
export type Shooters = QueryOf<typeof ShooterQuery>;
