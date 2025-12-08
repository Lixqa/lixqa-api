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
    this.server.logger.debug('MiddlewareManager.init() - Starting middleware initialization');
    
    const routesBasePath = path.join(process.cwd(), this.server.routesBasePath);
    this.server.logger.debug(`Loading middlewares from: ${routesBasePath}`);

    // Check if routes directory exists
    try {
      const files = findFilesRecursive(
        routesBasePath,
        (entry) =>
          entry.name.endsWith('.middleware.ts') ||
          entry.name.endsWith('.mw.ts') ||
          entry.name === '#.ts',
      );

      this.server.logger.debug(`Found ${files.length} middleware files`);

      for (const filePath of files) {
        try {
          const middleware = new Middleware(filePath);
          // Use file path as key to maintain order
          this.items.set(filePath, middleware);
          Logger.middlewareLoaded(middleware);
          this.server.logger.debug(`Loaded middleware: ${filePath}`);
        } catch (error) {
          console.error(`Failed to load middleware ${filePath}:`, error);
          this.server.logger.debug(`Failed to load middleware ${filePath}:`, error);
        }
      }

      this.server.logger.debug(`Middleware initialization complete. Total middlewares: ${this.items.size}`);
    } catch (error) {
      // Routes directory doesn't exist, that's okay (will be handled by RouteManager)
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn(
          `Failed to initialize middleware from routes directory:`,
          error,
        );
        this.server.logger.debug('Failed to initialize middleware from routes directory:', error);
      } else {
        this.server.logger.debug('Routes directory does not exist, skipping middleware loading');
      }
    }
  }

  async executeAll(api: any): Promise<void> {
    this.server.logger.debug(`Executing ${this.items.size} middlewares for route: ${api.route?.path || 'unknown'}`);
    
    // Execute middleware in order (Collection maintains insertion order)
    let index = 0;
    for (const middleware of this.items.values()) {
      this.server.logger.debug(`Executing middleware ${index + 1}/${this.items.size}: ${middleware.filePath}`);
      const result = middleware.file.fn(api);
      if (result instanceof Promise) {
        await result;
      }
      index++;
    }

    this.server.logger.debug('All middlewares executed successfully');
  }
}
