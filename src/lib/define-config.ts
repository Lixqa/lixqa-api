import { Config } from './typings/types';

export function defineConfig<T extends Config>(config: T): T {
  return config;
}
