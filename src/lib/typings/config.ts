import type { RouteSettings, RouteRatelimits } from './route-settings';

/**
 * Server configuration
 */
export type Config<TAuth = any, TServices = undefined> = {
  port: number;
  hostname: string;
  responseDetailLevel: 'full' | 'mid' | 'low' | 'blank';
  defaults: RouteSettings<TAuth, TServices>;
  ratelimits: RouteRatelimits;
  upload?: {
    store: 'memory' | 'disk';
    diskPath?: string;
  };
  debug?: boolean;
};

