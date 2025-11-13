import type { SchemaDefinition } from './typings';

export function defineSchema<T extends SchemaDefinition>(schema: T): T {
  return schema;
}
