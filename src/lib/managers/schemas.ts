import path from 'path';
import { Schema } from '../structures/schema';
import { Collection } from '@discordjs/collection';
import { findFilesRecursive } from '../helpers/utils';
import { Logger } from '../helpers/logger';
import { Server } from '../structures/server';

export class SchemaManager {
  items: Collection<string, Schema> = new Collection();
  server: any;

  constructor(server: any) {
    this.server = server;
  }

  init() {
    const tsFiles = findFilesRecursive(
      path.join(process.cwd(), this.server.routesBasePath),
      (entry) => entry.name.endsWith('.schema.ts'),
    );

    for (const filePath of tsFiles) {
      try {
        const schema = new Schema(filePath);
        this.items.set(schema.path, schema);
        Logger.schemaLoaded(schema);
      } catch (error) {
        console.error(`Failed to load schema ${filePath}:`, error);
      }
    }
  }
}
