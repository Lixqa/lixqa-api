import { Server } from './structures/server';
import { defineRoute as _defineRoute } from './define-route';
import { RouteDefinition, SchemaDefinition } from './typings/types';
import { API } from './structures/api';

function createApp<TAuth = any, TServices = undefined>({
  authenticationMethod,
  routesBasePath,
  services,
  onError,
}: {
  authenticationMethod: (token: string) => Promise<TAuth> | TAuth;
  routesBasePath: string;
  services?: TServices;
  onError?: ({
    api,
    error,
  }: {
    api: API<unknown, unknown, unknown, unknown, TAuth, TServices>;
    error: unknown;
  }) => void;
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
