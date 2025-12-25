import { filePathToRoutePath } from '../helpers/parser';
import type { SchemaDefinition } from '../typings';
import { isZodObject } from '../helpers/utils';
import { Logger } from '../helpers/logger';

export class Schema {
  filePath: string;
  file: SchemaDefinition;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.file = this.loadFile();
    this.checkDeprecations();
  }

  private loadFile(): SchemaDefinition {
    try {
      const routeModule = require(this.filePath);
      return routeModule.default || routeModule;
    } catch (error) {
      console.warn(`Failed to load ${this.filePath}:`, error);
      return {} as SchemaDefinition;
    }
  }

  private checkDeprecations() {
    const schema = this.file;
    const location = this.path;

    // Check params
    if (schema.params && isZodObject(schema.params)) {
      Logger.deprecationWarning(
        'Using z.object() for params schema is deprecated. Use a plain object instead: params: { userId: z.string() }',
        location,
      );
    }

    // Check query in method-specific schemas
    const routeMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
    for (const method of routeMethods) {
      if (schema[method]?.query && isZodObject(schema[method].query)) {
        Logger.deprecationWarning(
          `Using z.object() for query schema in ${method} is deprecated. Use a plain object instead: query: { limit: z.number() }`,
          location,
        );
      }
    }
  }

  get path(): string {
    return filePathToRoutePath(this.filePath);
  }

  toString() {
    return this.path;
  }
}
