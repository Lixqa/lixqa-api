import type { SchemaDefinition } from './typings';
import { normalizeObjectSchema, isZodObject } from './helpers/utils';
import { Logger } from './helpers/logger';
import { z } from 'zod';

/**
 * Normalizes a schema definition by converting plain objects for params to z.object() schemas.
 * Query schemas must be z.object() and are not normalized.
 */
function normalizeSchemaDefinition<T extends SchemaDefinition>(schema: T): T {
  const normalized = { ...schema } as any;

  // Normalize params if it exists (allow plain objects)
  if (normalized.params) {
    // Don't log deprecation warning here - it will be handled in route validation
    if (!('_def' in normalized.params)) {
      normalized.params = normalizeObjectSchema(normalized.params);
    }
  }

  // Query schemas must be z.object() - no normalization needed
  // TypeScript will enforce this at compile time

  return normalized as T;
}

export function defineSchema<T extends SchemaDefinition>(schema: T): T {
  return normalizeSchemaDefinition(schema);
}
