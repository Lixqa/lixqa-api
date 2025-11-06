import {
  RouteDefinition,
  SchemaDefinition,
  SharedPreAPI,
} from './typings/types';

export function defineRoute<
  Schema extends SchemaDefinition = object,
  TAuth = any,
  TServices = undefined,
  TShared = unknown,
>(
  route: RouteDefinition<Schema, TAuth, TServices, TShared> & {
    shared: {
      pre: (
        api: SharedPreAPI<Schema, TAuth, TServices>,
      ) => TShared | Promise<TShared>;
    };
  },
): RouteDefinition<Schema, TAuth, TServices, TShared>;

export function defineRoute<
  Schema extends SchemaDefinition = object,
  TAuth = any,
  TServices = undefined,
>(
  route: RouteDefinition<Schema, TAuth, TServices, undefined>,
): RouteDefinition<Schema, TAuth, TServices, undefined>;

export function defineRoute(route: any): any {
  return route;
}
