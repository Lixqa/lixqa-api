import { Server } from './structures/server';
import { defineRoute as _defineRoute } from './define-route';
import { RouteDefinition, SchemaDefinition } from './typings/types';

function createApp<TAuth = any, TServices = undefined>({
  authenticationMethod,
  routesBasePath,
  services,
  onError,
}: {
  authenticationMethod: (token: string) => Promise<TAuth> | TAuth;
  routesBasePath: string;
  services?: TServices;
  onError?: (error: unknown) => void;
}) {
  const server = new Server<TAuth, TServices>({
    authenticationMethod,
    routesBasePath,
    services,
    onError,
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
