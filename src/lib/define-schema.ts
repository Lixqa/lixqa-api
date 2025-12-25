import type { SchemaDefinition } from './typings';
import { normalizeObjectSchema, isZodObject } from './helpers/utils';
import { Logger } from './helpers/logger';
import { z } from 'zod';

/**
 * Normalizes a schema definition by converting plain objects for params and query to z.object() schemas
 */
function normalizeSchemaDefinition<T extends SchemaDefinition>(schema: T): T {
  const normalized = { ...schema } as any;

  // Normalize params if it exists
  if (normalized.params) {
    // Check if it's using deprecated z.object() syntax
    if (isZodObject(normalized.params)) {
      Logger.deprecationWarning(
        'Using z.object() for params schema is deprecated. Use a plain object instead: params: { userId: z.string() }',
        'defineSchema',
      );
    }
    if (!('_def' in normalized.params)) {
      normalized.params = normalizeObjectSchema(normalized.params);
    }
  }

  // Normalize query schemas in method-specific schemas
  const routeMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
  for (const method of routeMethods) {
    if (normalized[method]?.query) {
      // Check if it's using deprecated z.object() syntax
      if (isZodObject(normalized[method].query)) {
        Logger.deprecationWarning(
          `Using z.object() for query schema in ${method} is deprecated. Use a plain object instead: query: { limit: z.number() }`,
          'defineSchema',
        );
      }
      if (!('_def' in normalized[method].query)) {
        normalized[method] = {
          ...normalized[method],
          query: normalizeObjectSchema(normalized[method].query),
        };
      }
    }
  }

  return normalized as T;
}

export function defineSchema<T extends SchemaDefinition>(schema: T): T {
  return normalizeSchemaDefinition(schema);
}
