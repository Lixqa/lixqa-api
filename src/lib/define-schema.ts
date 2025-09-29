import { SchemaDefinition } from './typings/types';

export function defineSchema<T extends SchemaDefinition>(schema: T): T {
  return schema;
}
