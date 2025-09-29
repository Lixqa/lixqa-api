import { Server } from './structures/server';
import { defineRoute as _defineRoute } from './define-route';
import { RouteDefinition, SchemaDefinition } from './typings/types';

function createApp<TAuth = any>({
  authenticationMethod,
  routesBasePath,
}: {
  authenticationMethod: (token: string) => Promise<TAuth> | TAuth;
  routesBasePath: string;
}) {
  const server = new Server<TAuth>({
    authenticationMethod,
    routesBasePath,
  });

  const defineRoute = <V extends SchemaDefinition = object>(
    route: RouteDefinition<V, TAuth>,
  ) => _defineRoute<V, TAuth>(route);

  return {
    server,
    defineRoute,
  };
}

export { createApp };
