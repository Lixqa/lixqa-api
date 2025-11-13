import { API } from '../structures/api';

/**
 * Route settings configuration
 */
export type RouteSettings<TAuth = any, TServices = undefined> = {
  unauthed: boolean;
  disabled: boolean;
  moved: boolean;
  authOverwrite:
    | ((
        api: API<unknown, unknown, unknown, unknown, TAuth, TServices>,
      ) => boolean | Promise<boolean>)
    | null;
  upload?: {
    store: 'memory' | 'disk';
    diskPath?: string;
  } | null;
};

/**
 * Rate limit configuration
 */
export type RouteRatelimits = {
  limit: number;
  remember: number;
  punishment: number;
  strict: boolean;
  type: 'endpoint' | 'parameter';
  scope: 'ip' | 'authentication' | 'global';
};

