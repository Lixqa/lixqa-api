import type { Config } from './typings';

export function defineConfig<T extends Config>(config: T): T {
  return config;
}
