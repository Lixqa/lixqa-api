import type { MiddlewareDefinition } from '../typings/middleware';
import { Logger } from '../helpers/logger';

export class Middleware {
  filePath: string;
  file: MiddlewareDefinition;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.file = this.loadFile();
  }

  private loadFile(): MiddlewareDefinition {
    try {
      const middlewareModule = require(this.filePath);
      return middlewareModule.default || middlewareModule;
    } catch (error) {
      Logger.warning(`Failed to load middleware ${this.filePath}:`);
      Logger.error(`Failed to load middleware ${this.filePath}:`, error);
      return { fn: () => {} } as MiddlewareDefinition;
    }
  }

  toString() {
    return this.filePath;
  }
}

