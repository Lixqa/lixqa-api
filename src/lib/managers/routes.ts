import path from 'path';
import fs from 'fs';
import { Route } from '../structures/route';
import { Logger } from '../helpers/logger';
import { Schema } from '../structures/schema';
import { match } from 'path-to-regexp';
import { Collection } from '@discordjs/collection';
import { findFilesRecursive } from '../helpers/utils';

export class RouteManager {
  items: Collection<string, Route> = new Collection();

  server: any;

  constructor(server: any) {
    this.server = server;
  }

  init() {
    this.server.logger.debug(
      'RouteManager.init() - Starting route initialization',
    );

    // Load internal routes first (but don't add to items yet)
    // This gives us the paths for conflict checking
    this.server.logger.debug('Loading internal routes...');
    const { routes: internalRoutes, paths: reservedPaths } =
      this.loadInternalRoutes();

    this.server.logger.debug(
      `Internal routes loaded: ${internalRoutes.size} routes, ${reservedPaths.size} reserved paths`,
    );
    this.server.logger.debug(
      `Reserved paths: ${Array.from(reservedPaths).join(', ') || '(none)'}`,
    );

    // Load user routes first
    const userRoutesBasePath = path.join(
      process.cwd(),
      this.server.routesBasePath,
    );
    this.server.logger.debug(`Loading user routes from: ${userRoutesBasePath}`);

    const userRouteFiles = findFilesRecursive(
      userRoutesBasePath,
      (entry) =>
        entry.name.endsWith('.ts') && !entry.name.endsWith('.schema.ts'),
    );

    this.server.logger.debug(`Found ${userRouteFiles.length} user route files`);

    for (const filePath of userRouteFiles) {
      try {
        const route = new Route(this.server, filePath);
        this.server.logger.debug(
          `Checking user route: ${route.path} (from ${filePath})`,
        );

        // Dynamically check if user route conflicts with any reserved internal route
        if (reservedPaths.has(route.path)) {
          Logger.warning(
            `Route "${route.path}" is reserved and will be overridden by the built-in route.`,
          );
          this.server.logger.debug(
            `CONFLICT DETECTED: Route "${route.path}" is reserved`,
          );
          continue; // Skip adding user's route
        }

        this.items.set(route.path, route);
        Logger.routeLoaded(route);
      } catch (error) {
        console.error(`Failed to load route ${filePath}:`, error);
      }
    }

    this.server.logger.debug(
      `User routes loaded. Total routes in items: ${this.items.size}`,
    );

    // Now add internal routes to items (so they override user routes)
    this.server.logger.debug('Adding internal routes to items collection...');
    internalRoutes.forEach((route, routePath) => {
      this.server.logger.debug(`Adding internal route: ${routePath}`);
      this.items.set(routePath, route);
    });

    this.server.logger.debug(
      `Route initialization complete. Total routes: ${this.items.size}`,
    );
  }

  private getInternalRoutesPath(): string {
    // Get the path to internal-routes directory
    // This works both in source (src/lib/managers/routes.ts -> src/internal-routes)
    // and compiled (dist/lib/managers/routes.js -> dist/internal-routes)
    const currentDir = __dirname;
    const internalRoutesPath = path.join(currentDir, '../../internal-routes');
    this.server.logger.debug(
      `getInternalRoutesPath() - Current dir: ${currentDir}`,
    );
    this.server.logger.debug(
      `getInternalRoutesPath() - Internal routes path: ${internalRoutesPath}`,
    );
    return internalRoutesPath;
  }

  private findInternalRouteFiles(): string[] {
    const internalRoutesPath = this.getInternalRoutesPath();

    // Check if internal-routes directory exists
    const exists = fs.existsSync(internalRoutesPath);
    this.server.logger.debug(
      `findInternalRouteFiles() - Directory exists: ${exists}`,
    );

    if (!exists) {
      this.server.logger.debug(
        'findInternalRouteFiles() - No internal-routes directory found, returning empty array',
      );
      return []; // No internal routes directory, return empty array
    }

    const files = findFilesRecursive(
      internalRoutesPath,
      (entry) =>
        (entry.name.endsWith('.ts') || entry.name.endsWith('.js')) &&
        !entry.name.endsWith('.schema.ts') &&
        !entry.name.endsWith('.schema.js') &&
        !entry.name.endsWith('.d.ts') &&
        !entry.name.endsWith('.d.js'),
    );

    this.server.logger.debug(
      `findInternalRouteFiles() - Found ${files.length} files:`,
      files,
    );
    return files;
  }

  private loadInternalRoutes(): {
    routes: Collection<string, Route>;
    paths: Set<string>;
  } {
    this.server.logger.debug(
      'loadInternalRoutes() - Starting to load internal routes',
    );
    const routes = new Collection<string, Route>();
    const paths = new Set<string>();
    const internalRouteFiles = this.findInternalRouteFiles();

    this.server.logger.debug(
      `loadInternalRoutes() - Processing ${internalRouteFiles.length} internal route files`,
    );

    for (const filePath of internalRouteFiles) {
      try {
        // Convert .ts to .js if needed for runtime (require() needs .js)
        const runtimePath = filePath.replace(/\.ts$/, '.js');
        this.server.logger.debug(
          `loadInternalRoutes() - Loading file: ${filePath} -> runtime: ${runtimePath}`,
        );

        const route = new Route(this.server, runtimePath);
        this.server.logger.debug(
          `loadInternalRoutes() - Route created with path: ${route.path}`,
        );

        routes.set(route.path, route);
        paths.add(route.path);
        Logger.routeLoaded(route);
        this.server.logger.debug(
          `loadInternalRoutes() - Successfully loaded route ${route.path}`,
        );
      } catch (error) {
        console.error(`Failed to load internal route ${filePath}:`, error);
        this.server.logger.debug(
          `loadInternalRoutes() - Failed to load internal route ${filePath}:`,
          error,
        );
      }
    }

    this.server.logger.debug(
      `loadInternalRoutes() - Complete. Loaded ${routes.size} routes, ${paths.size} paths`,
    );
    return { routes, paths };
  }

  mergeSchemas(schemas: Collection<string, Schema>) {
    this.server.logger.debug(`Merging ${schemas.size} schemas with routes...`);

    let mergedCount = 0;
    schemas.forEach((schema) => {
      const matchingRoute = this.items.find(
        (route) => route.path == schema.path,
      );

      if (matchingRoute) {
        matchingRoute.schema = schema;
        mergedCount++;
        this.server.logger.debug(`Merged schema for route: ${schema.path}`);
      } else {
        this.server.logger.debug(
          `No matching route found for schema: ${schema.path}`,
        );
      }
    });

    this.server.logger.debug(
      `Schema merge complete. Merged ${mergedCount}/${schemas.size} schemas`,
    );
  }

  resolveUrl(url: string) {
    for (const route of this.items.values()) {
      const matched = match(route.path, { decode: decodeURIComponent })(url);

      if (matched) {
        return { route, params: matched.params, path: matched.path };
      }
    }

    return null;
  }
}
