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
    | undefined = RouteShared<Schema, TAuth, TServices, undefined> | undefined,
  TShared = TSharedConfig extends RouteShared<
    Schema,
    TAuth,
    TServices,
    infer TResult
  >
    ? Awaited<TResult>
    : undefined,
>(
  route: RouteDefinition<Schema, TAuth, TServices, TShared> & {
    shared?: TSharedConfig;
  },
): RouteDefinition<Schema, TAuth, TServices, TShared> & {
  shared?: TSharedConfig;
} {
  return route;
}
