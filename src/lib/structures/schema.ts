import { filePathToRoutePath } from '../helpers/parser';
import type { SchemaDefinition } from '../typings';
import { Logger } from '../helpers/logger';

export class Schema {
  filePath: string;
  file: SchemaDefinition;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.file = this.loadFile();
  }

  private loadFile(): SchemaDefinition {
    try {
      const routeModule = require(this.filePath);
      return routeModule.default || routeModule;
    } catch (error) {
      Logger.warning(`Failed to load ${this.filePath}:`);
      Logger.error(`Failed to load ${this.filePath}:`, error);
      return {} as SchemaDefinition;
    }
  }

  get path(): string {
    return filePathToRoutePath(this.filePath);
  }

  toString() {
    return this.path;
  }
}
