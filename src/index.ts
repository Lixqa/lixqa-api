export { Config } from './lib/typings/types';
export { defineSchema } from './lib/define-schema';
export { defineConfig } from './lib/define-config';
export { createApp } from './lib/create-app';

function catchApiKill(e: unknown) {
  if (typeof e == 'string' && e == 'API_KILL') return;
}

process.addListener('uncaughtException', catchApiKill);
process.addListener('unhandledRejection', catchApiKill);
