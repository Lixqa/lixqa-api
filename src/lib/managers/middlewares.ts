import path from 'path';
import { Middleware } from '../structures/middleware';
import { Collection } from '@discordjs/collection';
import { findFilesRecursive } from '../helpers/utils';
import { Logger } from '../helpers/logger';

export class MiddlewareManager {
  items: Collection<string, Middleware> = new Collection();

  server: any;

  constructor(server: any) {
    this.server = server;
  }

  init() {
    const routesBasePath = path.join(process.cwd(), this.server.routesBasePath);

    // Check if routes directory exists
    try {
      const files = findFilesRecursive(
        routesBasePath,
        (entry) =>
          entry.name.endsWith('.middleware.ts') ||
          entry.name.endsWith('.mw.ts') ||
          entry.name === '#.ts',
      );

      for (const filePath of files) {
        try {
          const middleware = new Middleware(filePath);
          // Use file path as key to maintain order
          this.items.set(filePath, middleware);
          Logger.middlewareLoaded(middleware);
        } catch (error) {
          console.error(`Failed to load middleware ${filePath}:`, error);
        }
      }
    } catch (error) {
      // Routes directory doesn't exist, that's okay (will be handled by RouteManager)
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn(
          `Failed to initialize middleware from routes directory:`,
          error,
        );
      }
    }
  }

  async executeAll(api: any): Promise<void> {
    // Execute middleware in order (Collection maintains insertion order)
    for (const middleware of this.items.values()) {
      const result = middleware.file.fn(api);
      if (result instanceof Promise) {
        await result;
      }
    }
  }
}
