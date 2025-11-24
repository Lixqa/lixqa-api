import type { API } from '../structures/api';

/**
 * Middleware function that receives the API context
 */
export type MiddlewareFunction<
  TAuth = any,
  TServices = undefined,
> = (api: API<unknown, unknown, unknown, unknown, TAuth, TServices>) =>
  | void
  | Promise<void>;

/**
 * Middleware definition structure
 */
export type MiddlewareDefinition<
  TAuth = any,
  TServices = undefined,
> = {
  fn: MiddlewareFunction<TAuth, TServices>;
};

