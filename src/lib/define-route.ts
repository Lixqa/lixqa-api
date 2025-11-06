import { RouteDefinition, SchemaDefinition } from './typings/types';

type SharedResult<TRoute> = TRoute extends {
  shared?: { pre?: (api: any) => infer TResult };
}
  ? Awaited<TResult>
  : undefined;

export function defineRoute<
  Schema extends SchemaDefinition = object,
  TAuth = any,
  TServices = undefined,
  TRoute extends RouteDefinition<
    Schema,
    TAuth,
    TServices,
    any
  > = RouteDefinition<Schema, TAuth, TServices, unknown>,
  TShared = SharedResult<TRoute>,
>(route: TRoute): RouteDefinition<Schema, TAuth, TServices, TShared> & TRoute {
  return route as RouteDefinition<Schema, TAuth, TServices, TShared> & TRoute;
}
