import express, {
  NextFunction as ExpressNextFunction,
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';
import { API } from './api';
import cors from 'cors';
import type { Config, Request, Response, RouteMethod } from '../typings';
import { Logger } from '../helpers/logger';
import { StatusCodes } from 'http-status-codes';
import { RouteManager } from '../managers/routes';
import { SchemaManager } from '../managers/schemas';
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
  ratelimits = new RatelimitManager();
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
  }) {
    this.authenticationMethod = setup.authenticationMethod;
    this.routesBasePath = setup.routesBasePath;
    this.services = setup.services as TServices;

    this.routes = new RouteManager(this);
    this.schemas = new SchemaManager(this);

    this.onError = setup.onError;

    this.app = express();

    this.app.use(
      cors({
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization'],
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

    this.app.use((_req, _res, next) => {
      const req = _req as Request<TAuth, TServices>;
      const res = _res as Response;

      const resolved = this.routes.resolveUrl(req.path);

      const api = new API<unknown, unknown, unknown, unknown, TAuth, TServices>(
        req,
        res,
        resolved?.route,
        this,
      );

      if (!resolved) return api.throw(StatusCodes.NOT_FOUND);

      req.api = api;

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

        upload(_req as any, _res as any, (err: any) => {
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
        _: ExpressResponse,
        next: ExpressNextFunction,
      ) => {
        const req = _req as Request<TAuth, TServices>;

        const error = err as SyntaxError & { status?: number; body?: string };
        if (
          error instanceof SyntaxError &&
          error.status === 400 &&
          error.body
        ) {
          req.api.throw(StatusCodes.BAD_REQUEST, { data: 'Invalid JSON' });
        }

        next(err);
      },
    );

    this.app.use(async (_req) => {
      const req = _req as Request<TAuth, TServices>;

      const api = req.api;
      const route = api.route!;

      const handler = route.file[req.method as RouteMethod];

      const settings = route.settingsFor(api.method);

      if (settings.disabled) api.throw(StatusCodes.SERVICE_UNAVAILABLE);
      if (settings.moved)
        api.throw(StatusCodes.MOVED_PERMANENTLY, { data: settings.moved });

      if (this.ratelimits.check(api)) api.throw(StatusCodes.TOO_MANY_REQUESTS);
      this.ratelimits.increase(api);

      await api.authorize();

      const errors = api.validateSchema();

      const hasErrors = Object.values(errors).some((e) => e !== undefined);

      if (hasErrors) {
        return api.throw(StatusCodes.BAD_REQUEST, { data: errors });
      }

      if (handler) {
        // The handler expects a ConditionalAPI type, but we can't infer the schema types at runtime
        // So we cast to the expected type while preserving the authentication typing
        // This allows the route handler to get the correct typing for schema-based properties
        try {
          await handler(api as any);
        } catch (error) {
          if (typeof error == 'string' && error == 'API_KILL') return;
          this.onError?.({ api, error });
          api.throw(StatusCodes.INTERNAL_SERVER_ERROR);
        }
      } else {
        api.throw(StatusCodes.METHOD_NOT_ALLOWED);
      }
    });
  }

  async init() {
    this.initConfig();
    this.routes.init();
    this.schemas.init();
    this.routes.mergeSchemas(this.schemas.items);
  }

  async start() {
    Logger.starting();

    return new Promise<void>((resolve) => {
      this.app.listen(this.config.port, () => {
        Logger.serverStarted({
          port: this.config.port,
          seconds: process.uptime(),
        });
        resolve();
      });
    });
  }

  private initConfig(): void {
    const variations = ['lixqa-api.config.js', 'lixqa-api.config.ts'];

    for (const variation of variations) {
      const filePath = path.join(process.cwd(), variation);
      const exists = fs.existsSync(filePath);
      if (!exists) continue;

      try {
        const configModule = require(filePath);
        this.config = (configModule?.default ?? configModule) as Config<
          TAuth,
          TServices
        >;
        console.log('Inited config', this.config);
        return;
      } catch (err) {
        console.warn(`Failed to load config: ${filePath}`);
        console.warn(err);
      }
    }
  }
}
