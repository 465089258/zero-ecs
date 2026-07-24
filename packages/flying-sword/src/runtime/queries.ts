import { QueryType, With } from "@zero-ecs/game";
import {
    FlyingSwordGroupStorage,
    FlyingSwordStorage,
} from "./storage";

export const FlyingSwordGroupStorageQuery =
    QueryType.from(With(FlyingSwordGroupStorage));

export const FlyingSwordStorageQuery =
    QueryType.from(With(FlyingSwordStorage));
