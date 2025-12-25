import path from 'path';
import { Schema } from '../structures/schema';
import { Collection } from '@discordjs/collection';
import { findFilesRecursive } from '../helpers/utils';
import { Logger } from '../helpers/logger';

export class SchemaManager {
  items: Collection<string, Schema> = new Collection();
  server: any;

  constructor(server: any) {
    this.server = server;
  }

  init() {
    this.server.logger.debug('SchemaManager.init() - Starting schema initialization');
    
    const schemaBasePath = path.join(process.cwd(), this.server.routesBasePath);
    this.server.logger.debug(`Loading schemas from: ${schemaBasePath}`);
    
    const tsFiles = findFilesRecursive(
      schemaBasePath,
      (entry) => entry.name.endsWith('.schema.ts'),
    );

    this.server.logger.debug(`Found ${tsFiles.length} schema files`);

    for (const filePath of tsFiles) {
      try {
        const schema = new Schema(filePath);
        this.items.set(schema.path, schema);
        Logger.schemaLoaded(schema);
        this.server.logger.debug(`Loaded schema: ${schema.path} (from ${filePath})`);
      } catch (error) {
        Logger.error(`Failed to load schema ${filePath}:`, error);
        this.server.logger.debug(`Failed to load schema ${filePath}:`, error);
      }
    }

    this.server.logger.debug(`Schema initialization complete. Total schemas: ${this.items.size}`);
  }

  validateSchemas(routes: Collection<string, any>) {
    this.server.logger.debug('Validating schemas...');
    let orphanedCount = 0;

    this.items.forEach((schema) => {
      const matchingRoute = routes.find((route) => route.path === schema.path);
      if (!matchingRoute) {
        Logger.warning(
          `Schema file found for "${schema.path}" but no matching route exists. The schema will be ignored.`,
          schema.filePath,
        );
        orphanedCount++;
      }
    });

    this.server.logger.debug(
      `Schema validation complete. ${orphanedCount} orphaned schema(s) found.`,
    );
  }
}
