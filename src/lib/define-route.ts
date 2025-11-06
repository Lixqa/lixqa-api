import { RouteDefinition, SchemaDefinition } from './typings/types';

// Helper type to extract the return type of shared.pre
type InferShared<T> = T extends {
  shared: { pre: (...args: any[]) => infer R };
}
  ? R extends Promise<infer U>
    ? U
    : R
  : undefined;

export function defineRoute<
  Schema extends SchemaDefinition = object,
  TAuth = any,
  TServices = undefined,
  Route extends RouteDefinition<
    Schema,
    TAuth,
    TServices,
    any
  > = RouteDefinition<Schema, TAuth, TServices, any>,
>(route: Route): RouteDefinition<Schema, TAuth, TServices, InferShared<Route>> {
  return route as any;
}
