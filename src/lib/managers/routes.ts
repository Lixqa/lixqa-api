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
    // Load internal routes first (but don't add to items yet)
    // This gives us the paths for conflict checking
    const { routes: internalRoutes, paths: reservedPaths } =
      this.loadInternalRoutes();

    // Load user routes first
    const userRouteFiles = findFilesRecursive(
      path.join(process.cwd(), this.server.routesBasePath),
      (entry) =>
        entry.name.endsWith('.ts') && !entry.name.endsWith('.schema.ts'),
    );

    for (const filePath of userRouteFiles) {
      try {
        const route = new Route(this.server, filePath);

        // Dynamically check if user route conflicts with any reserved internal route
        if (reservedPaths.has(route.path)) {
          console.warn(
            `Warning: Route "${route.path}" is reserved and will be overridden by the built-in route.`,
          );
          continue; // Skip adding user's route
        }

        this.items.set(route.path, route);
        Logger.routeLoaded(route);
      } catch (error) {
        console.error(`Failed to load route ${filePath}:`, error);
      }
    }

    // Now add internal routes to items (so they override user routes)
    internalRoutes.forEach((route, routePath) => {
      this.items.set(routePath, route);
    });
  }

  private getInternalRoutesPath(): string {
    // Get the path to internal-routes directory
    // This works both in source (src/lib/managers/routes.ts -> src/internal-routes)
    // and compiled (dist/lib/managers/routes.js -> dist/internal-routes)
    const currentDir = __dirname;
    return path.join(currentDir, '../../internal-routes');
  }

  private findInternalRouteFiles(): string[] {
    const internalRoutesPath = this.getInternalRoutesPath();

    // Check if internal-routes directory exists
    if (!fs.existsSync(internalRoutesPath)) {
      return []; // No internal routes directory, return empty array
    }

    return findFilesRecursive(
      internalRoutesPath,
      (entry) =>
        (entry.name.endsWith('.ts') || entry.name.endsWith('.js')) &&
        !entry.name.endsWith('.schema.ts') &&
        !entry.name.endsWith('.schema.js') &&
        !entry.name.endsWith('.d.ts') &&
        !entry.name.endsWith('.d.js'),
    );
  }

  private loadInternalRoutes(): {
    routes: Collection<string, Route>;
    paths: Set<string>;
  } {
    const routes = new Collection<string, Route>();
    const paths = new Set<string>();
    const internalRouteFiles = this.findInternalRouteFiles();

    for (const filePath of internalRouteFiles) {
      try {
        // Convert .ts to .js if needed for runtime (require() needs .js)
        const runtimePath = filePath.replace(/\.ts$/, '.js');
        const route = new Route(this.server, runtimePath);
        routes.set(route.path, route);
        paths.add(route.path);
        Logger.routeLoaded(route);
      } catch (error) {
        console.error(`Failed to load internal route ${filePath}:`, error);
      }
    }

    return { routes, paths };
  }

  mergeSchemas(schemas: Collection<string, Schema>) {
    schemas.forEach((schema) => {
      const matchingRoute = this.items.find(
        (route) => route.path == schema.path,
      );

      if (matchingRoute) matchingRoute.schema = schema;
    });
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
