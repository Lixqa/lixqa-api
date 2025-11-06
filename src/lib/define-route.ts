import { RouteDefinition } from './typings/types';

// Helper type to extract the return type of shared.pre
type InferShared<T> = T extends {
  shared: { pre: (...args: any[]) => infer R };
}
  ? Awaited<R>
  : undefined;

export function defineRoute<
  const Route extends RouteDefinition<any, any, any, any>,
>(
  route: Route,
): RouteDefinition<
  Route extends RouteDefinition<infer V, any, any, any> ? V : any,
  Route extends RouteDefinition<any, infer TAuth, any, any> ? TAuth : any,
  Route extends RouteDefinition<any, any, infer TServices, any>
    ? TServices
    : any,
  InferShared<Route>
> {
  return route as any;
}
