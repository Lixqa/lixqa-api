import { RouteDefinition, SchemaDefinition } from './typings/types';

export function defineRoute<
  Schema extends SchemaDefinition = object,
  TAuth = any,
  TServices = undefined,
  TShared = undefined,
>(
  route: RouteDefinition<Schema, TAuth, TServices, TShared>,
): RouteDefinition<Schema, TAuth, TServices, TShared> {
  return route;
}
