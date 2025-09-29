import { RouteDefinition, SchemaDefinition } from './typings/types';

export function defineRoute<
  Schema extends SchemaDefinition = object,
  TAuth = any,
>(route: RouteDefinition<Schema, TAuth>): RouteDefinition<Schema, TAuth> {
  return route;
}
