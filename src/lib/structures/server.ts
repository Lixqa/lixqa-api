import express, {
  NextFunction as ExpressNextFunction,
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';
import { API } from './api';
import cors from 'cors';
import type { Config, Request, Response, RouteMethod } from '../typings';
import { Logger, type StartupStats } from '../helpers/logger';
import { DebugLogger } from '../helpers/debug';
import { StatusCodes } from 'http-status-codes';
import { RouteManager } from '../managers/routes';
import { SchemaManager } from '../managers/schemas';
import { MiddlewareManager } from '../managers/middlewares';
import msgpack from 'msgpack5';
import getRawBody from 'raw-body';
import requestIp from 'request-ip';
import { RatelimitManager } from '../managers/ratelimits';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { createMulterStorage } from '../helpers/file-validators';
import { FileValidationOptions } from '../helpers/file-validators';

export const msgpackInstance = msgpack();

export class Server<TAuth = any, TServices = undefined> {
  private app: express.Application;
  routes: RouteManager;
  schemas: SchemaManager;
  middlewares: MiddlewareManager;
  ratelimits = new RatelimitManager();
  logger: DebugLogger;
  config: Config<TAuth, TServices> = undefined as unknown as Config<
    TAuth,
    TServices
  >;
  authenticationMethod: ({
    token,
    server,
  }: {
    token: string;
    server: Server<TAuth, TServices>;
  }) => Promise<TAuth> | TAuth;
  routesBasePath: string;
  services: TServices;
  onError?: ({
    api,
    error,
  }: {
    api: API<unknown, unknown, unknown, unknown, TAuth, TServices>;
    error: unknown;
  }) => void;
  startupStats: StartupStats = {
    warnings: 0,
    deprecationWarnings: 0,
    errors: 0,
    routesLoaded: 0,
    schemasLoaded: 0,
    middlewaresLoaded: 0,
  };

  constructor(setup: {
    authenticationMethod: ({
      token,
      server,
    }: {
      token: string;
      server: Server<TAuth, TServices>;
    }) => Promise<TAuth> | TAuth;
    routesBasePath: string;
    services?: TServices;
    onError?: ({
      api,
      error,
    }: {
      api: API<unknown, unknown, unknown, unknown, TAuth, TServices>;
      error: unknown;
    }) => void;
    cors?: {
      origin?:
        | string
        | string[]
        | ((
            origin: string | undefined,
            callback: (err: Error | null, allow?: boolean) => void,
          ) => void);
      methods?: string | string[];
      headers?: string | string[];
      extendHeaders?: string | string[];
    };
  }) {
    this.authenticationMethod = setup.authenticationMethod;
    this.routesBasePath = setup.routesBasePath;
    this.services = setup.services as TServices;

    // Initialize logger (will be updated with config in initConfig)
    this.logger = new DebugLogger(undefined);

    this.routes = new RouteManager(this);
    this.schemas = new SchemaManager(this);
    this.middlewares = new MiddlewareManager(this);

    this.onError = setup.onError;

    this.app = express();

    // Default CORS values
    const defaultOrigin = '*';
    const defaultMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
    const defaultHeaders = [
      'Content-Type',
      'Authorization',
      'x-bad-request-type',
      'x-ratelimit-limit',
      'x-ratelimit-remaining',
      'x-ratelimit-reset',
      'x-ratelimit-reset-after',
      'x-ratelimit-scope',
    ];

    // Build headers array: use headers if provided, otherwise merge defaultHeaders with extendHeaders
    let allowedHeaders: string[] = defaultHeaders;
    if (setup.cors?.headers) {
      allowedHeaders = Array.isArray(setup.cors.headers)
        ? setup.cors.headers
        : [setup.cors.headers];
    } else if (setup.cors?.extendHeaders) {
      const extendHeadersArray = Array.isArray(setup.cors.extendHeaders)
        ? setup.cors.extendHeaders
        : [setup.cors.extendHeaders];
      allowedHeaders = [...defaultHeaders, ...extendHeadersArray];
    }

    this.app.use(
      cors({
        origin: setup.cors?.origin ?? defaultOrigin,
        methods: setup.cors?.methods ?? defaultMethods,
        allowedHeaders,
        exposedHeaders: allowedHeaders,
      }),
    );

    this.app.use(requestIp.mw());

    this.app.use(
      async (
        req: ExpressRequest,
        res: ExpressResponse,
        next: ExpressNextFunction,
      ) => {
        if (req.is('application/octet-stream')) {
          try {
            const raw = await getRawBody(req);
            req.body = msgpackInstance.decode(raw);
          } catch {
            return res.status(400).json({ data: 'Invalid Binary' });
          }
        }
        next();
      },
    );

    this.app.use(express.json({ type: 'application/json' }));
    this.app.use(express.urlencoded({ extended: true }));

    // multipart/form-data support for both forms and file uploads will be applied after route resolution

    this.app.use(async (_req, _res, next) => {
      const req = _req as Request<TAuth, TServices>;
      const res = _res as Response;

      this.logger.debug(`Request received: ${req.method} ${req.path}`);

      const resolved = this.routes.resolveUrl(req.path);
      this.logger.debug(
        resolved
          ? `Route resolved: ${resolved.route.path} (params: ${JSON.stringify(resolved.params)})`
          : `Route not found: ${req.path}`,
      );

      const api = new API<unknown, unknown, unknown, unknown, TAuth, TServices>(
        req,
        res,
        resolved?.route,
        this,
      );

      req.api = api;

      if (!resolved) return api.throw(StatusCodes.NOT_FOUND);

      // If multipart, parse with multer now, using effective config (global or per-route)
      if (req.is('multipart/form-data')) {
        const contentType = (req.headers['content-type'] ?? '').toString();
        if (!/boundary=/i.test(contentType)) {
          return api.throw(StatusCodes.BAD_REQUEST, {
            data: 'Invalid multipart/form-data: missing boundary',
          });
        }
        const globalUploadConfig = this.config?.upload ?? {
          store: 'memory' as const,
        };
        const perRouteSettings = api.route?.settingsFor(api.method) as any;
        const effective = (perRouteSettings?.upload ?? globalUploadConfig) as {
          store: 'memory' | 'disk';
          diskPath?: string;
        };

        // Try to derive validation options from schema if present
        const methodSchema: any = api.route?.schema?.file?.[api.method];
        const fileOptions: Partial<FileValidationOptions> =
          (methodSchema?.files as any)?.__fileOptions ?? {};

        const storage = createMulterStorage(effective);
        const upload = multer({ storage }).any();

        upload(_req as any, _res as any, async (err: any) => {
          if (err) {
            return api.throw(StatusCodes.BAD_REQUEST, {
              data: err?.message || 'Invalid multipart/form-data',
            });
          }
          req._body = req.body as any;
          req._params = resolved.params as any;
          req._query = req.query as any;
          const files = (req as any).files as any[] | undefined;
          // Store raw array for validation
          (req as any)._filesRaw = files ?? [];
          // Always expose as array on API
          (req as any)._files = files ?? [];

          // Enforce field name convention based on schema option
          if (files && files.length > 0) {
            const invalid = fileOptions.multiple
              ? files.some((f) => f.fieldname !== 'files')
              : files.some((f) => f.fieldname !== 'file');
            if (invalid) {
              return api.throw(StatusCodes.BAD_REQUEST, {
                data: {
                  files: `Invalid file field name. Use '${fileOptions.multiple ? 'files' : 'file'}' in FormData`,
                },
              });
            }
          }

          // Do not enforce required here; allow Zod schema to generate structured errors
          next();
        });
        return;
      }

      req._body = req.body;
      req._params = resolved.params as any;
      req._query = req.query as any;

      next();
    });

    this.app.use(
      (
        err: unknown,
        _req: ExpressRequest,
        _res: ExpressResponse,
        next: ExpressNextFunction,
      ) => {
        //const req = _req as Request<TAuth, TServices>;

        const error = err as SyntaxError & { status?: number; body?: string };
        if (
          error instanceof SyntaxError &&
          error.status === 400 &&
          error.body
        ) {
          console.log('Invalid JSON', error);
          console.log('Body', error.body);
          //req.api.throw(StatusCodes.BAD_REQUEST, { data: 'Invalid JSON' }); // TODO: api is undefined here
          _res.status(StatusCodes.BAD_REQUEST).json({ data: 'Invalid JSON' });
        }

        next(err);
      },
    );

    this.app.use(async (_req) => {
      const req = _req as Request<TAuth, TServices>;

      const api = req.api;
      const route = api.route!;

      this.logger.debug(`Processing request: ${req.method} ${route.path}`);

      const handler = route.file[req.method as RouteMethod];

      const settings = route.settingsFor(api.method);

      if (settings.disabled) {
        this.logger.debug(`Route ${route.path} is disabled`);
        api.throw(StatusCodes.SERVICE_UNAVAILABLE);
      }
      if (settings.moved) {
        this.logger.debug(`Route ${route.path} moved to: ${settings.moved}`);
        api.throw(StatusCodes.MOVED_PERMANENTLY, { data: settings.moved });
      }

      this.logger.debug('Checking rate limits...');
      if (this.ratelimits.check(api)) {
        this.logger.debug('Rate limit exceeded, throwing 429');
        api.throw(StatusCodes.TOO_MANY_REQUESTS);
      }
      this.ratelimits.increase(api);

      this.logger.debug('Authorizing request...');
      await api.authorize();

      // Execute middleware after authentication but before schema validation
      try {
        await this.middlewares.executeAll(api);
      } catch (error) {
        if (typeof error == 'string' && error == 'API_KILL') return;
        this.logger.debug('Middleware execution error:', error);
        this.onError?.({ api, error });
        api.throw(StatusCodes.INTERNAL_SERVER_ERROR);
      }

      this.logger.debug('Validating schema...');
      const errors = api.validateSchema();

      const hasErrors = Object.values(errors).some((e) => e !== undefined);

      if (hasErrors) {
        this.logger.debug('Schema validation failed:', errors);
        api.header('x-bad-request-type', 'zod');
        return api.throw(StatusCodes.BAD_REQUEST, { data: errors });
      }

      if (handler) {
        this.logger.debug(
          `Executing route handler: ${req.method} ${route.path}`,
        );
        // The handler expects a ConditionalAPI type, but we can't infer the schema types at runtime
        // So we cast to the expected type while preserving the authentication typing
        // This allows the route handler to get the correct typing for schema-based properties
        try {
          await handler(api as any);
          this.logger.debug(
            `Route handler completed successfully: ${req.method} ${route.path}`,
          );
        } catch (error) {
          if (typeof error == 'string' && error == 'API_KILL') return;
          this.logger.debug(
            `Route handler error: ${req.method} ${route.path}`,
            error,
          );
          this.onError?.({ api, error });
          api.throw(StatusCodes.INTERNAL_SERVER_ERROR);
        }
      } else {
        this.logger.debug(
          `No handler found for method ${req.method} on route ${route.path}`,
        );
        api.throw(StatusCodes.METHOD_NOT_ALLOWED);
      }
    });
  }

  async init() {
    // Set up stats tracking for Logger
    Logger.setStatsTracker(this.startupStats);

    this.logger.debug('Server.init() - Starting server initialization');

    this.logger.debug('Initializing config...');
    this.initConfig();

    this.logger.debug('Initializing routes...');
    this.routes.init();

    this.logger.debug('Initializing schemas...');
    this.schemas.init();

    this.logger.debug('Initializing middlewares...');
    this.middlewares.init();

    this.logger.debug('Merging schemas with routes...');
    this.routes.mergeSchemas(this.schemas.items);

    this.logger.debug('Validating schemas...');
    this.schemas.validateSchemas(this.routes.items);

    this.logger.debug('Validating routes...');
    this.routes.validateRoutes();

    this.logger.debug('Server initialization complete');
  }

  async start() {
    Logger.starting();

    return new Promise<void>((resolve) => {
      this.app.listen(this.config.port, () => {
        Logger.serverStarted({
          port: this.config.port,
          seconds: process.uptime(),
          stats: this.startupStats,
        });
        // Clear stats tracker after startup
        Logger.clearStatsTracker();
        resolve();
      });
    });
  }

  private initConfig(): void {
    this.logger.debug('initConfig() - Looking for config files');
    const variations = ['lixqa-api.config.js', 'lixqa-api.config.ts'];

    for (const variation of variations) {
      const filePath = path.join(process.cwd(), variation);
      const exists = fs.existsSync(filePath);
      this.logger.debug(
        `Checking config file: ${filePath} (exists: ${exists})`,
      );

      if (!exists) continue;

      try {
        this.logger.debug(`Loading config from: ${filePath}`);
        const configModule = require(filePath);
        this.config = (configModule?.default ?? configModule) as Config<
          TAuth,
          TServices
        >;
        // Update logger with the loaded config
        this.logger.updateConfig(this.config);
        this.logger.debug('Config loaded successfully', {
          port: this.config.port,
          hostname: this.config.hostname,
          debug: this.config.debug,
        });
        return;
      } catch (err) {
        Logger.warning(`Failed to load config: ${filePath}`);
        Logger.error(`Failed to load config: ${filePath}`, err);
        this.logger.debug(`Failed to load config: ${filePath}`, err);
      }
    }

    this.logger.debug('No config file found, using defaults');
  }
}
