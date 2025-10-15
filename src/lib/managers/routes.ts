import path from 'path';
import { Route } from '../structures/route';
import { Logger } from '../helpers/logger';
import { Schema } from '../structures/schema';
import { match } from 'path-to-regexp';
import { Collection } from '@discordjs/collection';
import { findFilesRecursive } from '../helpers/utils';
import { Server } from '../structures/server';

export class RouteManager {
  items: Collection<string, Route> = new Collection();

  server: any;

  constructor(server: any) {
    this.server = server;
  }

  init() {
    const files = findFilesRecursive(
      path.join(process.cwd(), this.server.routesBasePath),
      (entry) =>
        entry.name.endsWith('.ts') && !entry.name.endsWith('.schema.ts'),
    );

    for (const filePath of files) {
      try {
        const route = new Route(this.server, filePath);
        this.items.set(route.path, route);
        Logger.routeLoaded(route);
      } catch (error) {
        console.error(`Failed to load route ${filePath}:`, error);
      }
    }
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
