import fs from 'fs';
import path from 'path';
import { z } from 'zod';

export function findFilesRecursive(
  dir: string,
  condition: (entry: fs.Dirent<string>) => boolean,
) {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...findFilesRecursive(fullPath, condition));
    } else if (entry.isFile() && condition(entry)) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Checks if a schema is a ZodObject (created with z.object())
 * This also detects schemas that started as z.object() but were transformed
 * with methods like .partial(), .strict(), etc.
 */
export function isZodObject(
  schema: unknown,
): schema is z.ZodObject<any, any> {
  if (!schema || typeof schema !== 'object' || !('_def' in schema)) {
    return false;
  }
  
  const def = (schema as any)._def;
  
  // Direct ZodObject check
  if (def?.typeName === 'ZodObject') {
    return true;
  }
  
  // Check if it has a 'shape' property, which is unique to ZodObject
  // (even when transformed with .partial(), .strict(), etc.)
  // This handles cases like z.object({...}).partial().strict()
  if (def?.shape && typeof def.shape === 'object') {
    return true;
  }
  
  return false;
}

/**
 * Normalizes a schema that can be either a Zod schema or a plain object with Zod schema properties.
 * If it's a plain object, wraps it in z.object(). Otherwise, returns it as-is.
 * 
 * @param schema - The schema to normalize
 * @param onDeprecated - Optional callback when a deprecated z.object() is detected
 * @param location - Optional location string for deprecation warnings
 */
export function normalizeObjectSchema(
  schema: z.ZodTypeAny | { [key: string]: z.ZodTypeAny },
  onDeprecated?: (field: 'params' | 'query', location?: string) => void,
  location?: string,
): z.ZodTypeAny {
  // Check if it's already a Zod schema (has _def property)
  if (schema && typeof schema === 'object' && '_def' in schema) {
    // Check if it's a ZodObject (z.object()) - this is deprecated for params/query
    if (isZodObject(schema) && onDeprecated) {
      // We don't know which field it is here, so we'll let the caller specify
      // This will be called from define-schema.ts where we know the context
    }
    return schema as z.ZodTypeAny;
  }
  
  // Otherwise, it's a plain object - wrap it in z.object()
  const normalized = z.object(schema as { [key: string]: z.ZodTypeAny });
  // Mark as normalized so we can distinguish from explicitly written z.object()
  (normalized as any).__normalized = true;
  return normalized;
}
