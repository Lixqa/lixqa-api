import { Server } from './structures/server';
import { defineRoute as _defineRoute } from './define-route';
import { RouteDefinition, SchemaDefinition } from './typings/types';

function createApp<TAuth = any, TServices = undefined>({
  authenticationMethod,
  routesBasePath,
  services,
}: {
  authenticationMethod: (token: string) => Promise<TAuth> | TAuth;
  routesBasePath: string;
  services?: TServices;
}) {
  const server = new Server<TAuth, TServices>({
    authenticationMethod,
    routesBasePath,
    services,
  });

  const defineRoute = <V extends SchemaDefinition = object>(
    route: RouteDefinition<V, TAuth, TServices>,
  ) => _defineRoute<V, TAuth, TServices>(route);

  return {
    server,
    defineRoute,
  };
}

export { createApp };
