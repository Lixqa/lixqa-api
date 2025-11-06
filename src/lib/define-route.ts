import { RouteDefinition, SchemaDefinition } from './typings/types';

export function defineRoute<
  Schema extends SchemaDefinition = object,
  TAuth = any,
  TServices = undefined,
>(
  route: RouteDefinition<Schema, TAuth, TServices>,
): RouteDefinition<Schema, TAuth, TServices> {
  return route;
}
