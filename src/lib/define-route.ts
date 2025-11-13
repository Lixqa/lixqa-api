import type { RouteDefinition, SchemaDefinition } from './typings';

export function defineRoute<
  Schema extends SchemaDefinition = object,
  TAuth = any,
  TServices = undefined,
>(
  route: RouteDefinition<Schema, TAuth, TServices>,
): RouteDefinition<Schema, TAuth, TServices> {
  return route;
}
