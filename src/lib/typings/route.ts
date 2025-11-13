import { API } from '../structures/api';
import type { RouteMethod } from './common';
import type { SchemaDefinition } from './schema';
import type { ConditionalAPI } from './api';
import type { RouteSettings, RouteRatelimits } from './route-settings';

/**
 * Route definition structure
 */
export type RouteDefinition<
  V extends SchemaDefinition = object,
  TAuth = any,
  TServices = undefined,
> = Partial<{
  [M in RouteMethod]: (api: ConditionalAPI<V, M, TAuth, TServices>) => void;
}> & {
  schema?: V;
  settings?: Partial<RouteSettings<TAuth, TServices>> & {
    [M in RouteMethod]?: Partial<RouteSettings<TAuth, TServices>>;
  };
  ratelimits?: Partial<RouteRatelimits> & {
    [M in RouteMethod]?: Partial<RouteRatelimits>;
  };
};

