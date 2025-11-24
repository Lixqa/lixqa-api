import type { MiddlewareDefinition } from '../typings/middleware';

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
      console.warn(`Failed to load middleware ${this.filePath}:`, error);
      return { fn: () => {} } as MiddlewareDefinition;
    }
  }

  toString() {
    return this.filePath;
  }
}

