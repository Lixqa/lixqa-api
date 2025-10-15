import { filePathToRoutePath } from '../helpers/parser';
import { RouteDefinition, RouteMethod } from '../typings/types';
import { Schema } from './schema';

export class Route {
  server: any;
  filePath: string;
  file: RouteDefinition;
  schema?: Schema;

  constructor(server: any, filePath: string) {
    this.server = server;
    this.filePath = filePath;
    this.file = this.loadFile();
  }

  private loadFile(): RouteDefinition {
    try {
      const routeModule = require(this.filePath);
      return routeModule.default || routeModule;
    } catch (error) {
      console.warn(`Failed to load handlers for ${this.filePath}:`, error);
      return {} as RouteDefinition;
    }
  }

  get path(): string {
    return filePathToRoutePath(this.filePath);
  }

  get methods(): string[] {
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
    return Object.keys(this.file).filter((key) => methods.includes(key));
  }

  settingsFor(method?: RouteMethod) {
    return {
      ...this.server.config.defaults,
      ...this.file.settings,
      ...(this.file.settings && method ? this.file.settings[method] : {}),
    };
  }

  ratelimitsFor(method?: RouteMethod) {
    return {
      ...this.server.config.ratelimits,
      ...this.file.ratelimits,
      ...(this.file.ratelimits && method ? this.file.ratelimits[method] : {}),
    };
  }

  toString() {
    return this.path;
  }
}
