import {
    QueryType,
    With,
} from "@zero-ecs/game";
import {
    FlyingSwordDirection3View,
    FlyingSwordPosition3View,
    FlyingSwordPreviousPosition3View,
    FlyingSwordView,
} from "@zero-ecs/flying-sword";
import {
    FlyingSwordVisualType,
} from "../content/components";

export const DemoFlyingSwordRenderQuery = QueryType.from(With(
    FlyingSwordView,
    FlyingSwordPreviousPosition3View,
    FlyingSwordPosition3View,
    FlyingSwordDirection3View,
    FlyingSwordVisualType,
));
