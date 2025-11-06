import {
  RouteDefinition,
  RouteShared,
  SchemaDefinition,
} from './typings/types';

export function defineRoute<
  Schema extends SchemaDefinition = object,
  TAuth = any,
  TServices = undefined,
  TSharedConfig extends
    | RouteShared<Schema, TAuth, TServices, any>
    | undefined = RouteShared<Schema, TAuth, TServices, undefined>,
>(
  route: RouteDefinition<Schema, TAuth, TServices, TSharedConfig>,
): RouteDefinition<Schema, TAuth, TServices, TSharedConfig> {
  return route;
}
