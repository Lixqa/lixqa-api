import { Server } from './structures/server';
import { defineRoute as _defineRoute } from './define-route';
import { defineMiddleware as _defineMiddleware } from './define-middleware';
import type {
  RouteDefinition,
  SchemaDefinition,
  MiddlewareDefinition,
} from './typings';
import { API } from './structures/api';

// Helper type to extract the return type from authenticationMethod
type ExtractAuthType<T> = T extends ({
  token,
  server,
}: {
  token: string;
  server: Server<unknown, unknown>;
}) => infer R
  ? Awaited<R>
  : never;

function createApp<
  TAuthMethod extends ({
    token,
    server,
  }: {
    token: string;
    server: Server<unknown, unknown>;
  }) => Promise<unknown> | unknown,
  TAuth = ExtractAuthType<TAuthMethod>,
  TServices = undefined,
>({
  authenticationMethod,
  routesBasePath,
  services,
  onError,
  cors,
}: {
  authenticationMethod: TAuthMethod;
  routesBasePath: string;
  services?: TServices;
  onError?: ({
    api,
    error,
  }: {
    api: API<unknown, unknown, unknown, unknown, TAuth, TServices>;
    error: unknown;
  }) => void;
  cors?: {
    origin?:
      | string
      | string[]
      | ((
          origin: string | undefined,
          callback: (err: Error | null, allow?: boolean) => void,
        ) => void);
    methods?: string | string[];
    headers?: string | string[];
    extendHeaders?: string | string[];
  };
}) {
  const server = new Server<TAuth, TServices>({
    authenticationMethod: authenticationMethod as ({
      token,
      server,
    }: {
      token: string;
      server: Server<TAuth, TServices>;
    }) => Promise<TAuth> | TAuth,
    routesBasePath,
    services,
    onError,
    cors,
  });

  const defineRoute = <V extends SchemaDefinition = object>(
    route: RouteDefinition<V, TAuth, TServices>,
  ) => _defineRoute<V, TAuth, TServices>(route);

  const defineMiddleware = (
    middleware: MiddlewareDefinition<TAuth, TServices>,
  ) => _defineMiddleware<TAuth, TServices>(middleware);

  return {
    server,
    defineRoute,
    defineMiddleware,
  };
}

export { createApp };
