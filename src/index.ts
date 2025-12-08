export type { Config } from './lib/typings';
export { defineSchema } from './lib/define-schema';
export { defineConfig } from './lib/define-config';
export { createApp } from './lib/create-app';
export { z } from 'zod';
export { StatusCodes as HttpStatus } from 'http-status-codes';
export {
  zFileSchema,
  zFile,
  createFileSchema,
  FileValidationPresets,
} from './lib/helpers/file-validators';
export { debugLog, DebugLogger } from './lib/helpers/debug';

function catchApiKill(e: unknown) {
  if (typeof e == 'string' && e == 'API_KILL') return;
}

process.addListener('uncaughtException', catchApiKill);
process.addListener('unhandledRejection', catchApiKill);
