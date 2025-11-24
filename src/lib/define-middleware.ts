import type { MiddlewareDefinition } from './typings/middleware';

export function defineMiddleware<
  TAuth = any,
  TServices = undefined,
>(
  middleware: MiddlewareDefinition<TAuth, TServices>,
): MiddlewareDefinition<TAuth, TServices> {
  return middleware;
}

