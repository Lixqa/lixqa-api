import type {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';
import type { Config, Request, Response, RouteMethod } from '../typings';
import { Route } from './route';
import z from 'zod';
import { getReasonPhrase, StatusCodes } from 'http-status-codes';
import { msgpackInstance, Server } from './server';

export class API<
  TBody = unknown,
  TParams = unknown,
  TQuery = unknown,
  TResponse = unknown,
  TAuth = any,
  TServices = undefined,
  TFiles = unknown,
> {
  private req: Request;
  private res: Response;
  route: Route | undefined;
  authentication: TAuth;
  server: Server<TAuth, TServices>;
  services: TServices;

  constructor(
    _req: ExpressRequest,
    res: ExpressResponse,
    route: Route | undefined,
    server: Server<TAuth, TServices>,
  ) {
    const req = _req as Request;
    req.startedAt = new Date();

    this.req = req;
    this.res = res;

    this.route = route;
    this.server = server;
    this.authentication = undefined as TAuth;
    this.services = server.services as TServices;
  }

  async authorize() {
    if (!this.route) return;

    const settings = this.route.settingsFor(this.method);

    // Check if authOverwrite exists
    if (settings.authOverwrite) {
      const passedAuthOverwrite = settings.authOverwrite(this);

      // If it is a promise, await it
      if (passedAuthOverwrite instanceof Promise) await passedAuthOverwrite;

      // If not passed, throw
      if (!passedAuthOverwrite) this.throw(StatusCodes.UNAUTHORIZED);

      // Passed, skip further auth
      return;
    }

    const token = this.req.headers.authorization?.trim();

    // No token provided
    if (!token) {
      if (!settings?.unauthed) {
        this.throw(StatusCodes.UNAUTHORIZED);
      }
      return;
    }

    // Token provided — try to find user
    const authenticationCall = this.server.authenticationMethod({
      token,
      server: this.server,
    });
    const authentication =
      authenticationCall instanceof Promise
        ? await authenticationCall
        : authenticationCall;

    // No user
    if (!authentication) {
      //Check if we allow unauthed
      if (!settings?.unauthed) {
        //We don't, throw
        this.throw(StatusCodes.UNAUTHORIZED);
      }

      //We do, allow
      return;
    }

    // User is there, set it
    this.authentication = authentication;
  }

  validateSchema() {
    const errors: {
      [key in 'body' | 'params' | 'query' | 'files']:
        | z.core.$ZodFormattedError<unknown, string>
        | undefined;
    } = {
      body: undefined,
      params: undefined,
      query: undefined,
      files: undefined,
    };

    if (!this.route) return errors;

    const method = this.method;

    const schema = this.route.schema?.file;

    const methodSchema = schema?.[method];

    if (
      method !== 'GET' &&
      methodSchema &&
      'body' in methodSchema &&
      methodSchema.body
    ) {
      if (!this.body) {
        console.warn('Request body is missing.');
      }
      const result = methodSchema.body.safeParse(this.body);
      if (!result.success) {
        console.warn('Request body validation failed.');
        errors.body = z.formatError(result.error);
      } else {
        this.req._body = result.data;
      }
    }

    // Validate uploaded files if schema provided
    if (
      method !== 'GET' &&
      methodSchema &&
      'files' in methodSchema &&
      (methodSchema as any).files
    ) {
      const filesSchema = (methodSchema as any).files as z.ZodTypeAny;
      // Always validate against the raw array, shape is enforced by server naming rule already
      const rawFiles = ((this.req as any)._filesRaw ??
        (this.req as any)._files) as any;
      const result = filesSchema.safeParse(rawFiles);
      if (!result.success) {
        console.warn('Files validation failed.');
        errors.files = z.formatError(result.error);
      } else {
        (this.req as any)._files = result.data as any;
      }
    }

    // Validate global params schema if it exists
    if (schema?.params) {
      const result = schema.params.safeParse(this.params);
      if (!result.success) {
        console.warn('Request params validation failed.', this.params);
        errors.params = z.formatError(result.error);
      } else {
        this.req._params = result.data as any;
      }
    }

    // Validate query params from method-specific schema
    if (methodSchema?.query) {
      const result = methodSchema.query.safeParse(this.query);
      if (!result.success) {
        console.warn('Request query validation failed.');
        errors.query = z.formatError(result.error);
      } else {
        this.req._query = result.data as any;
      }
    }

    const hasErrors = Object.values(errors).some((e) => e !== undefined);

    if (!hasErrors) {
      console.log('Schema validation passed.');
    }

    return errors;
  }

  send(
    data?: any,
    options?: {
      error?: boolean;
      status?: number;
      code?: string;
      message?: string;
    },
  ): never {
    const {
      error = false,
      status = 200,
      code: _code = 'SUCCESSFULLY',
      message: _message = 'Successfully',
    } = options ?? {};

    let [code, message] = [_code, _message];

    if (error) {
      message = getReasonPhrase(status);
      code = message.toUpperCase().replace(' ', '_');
    }

    const response = this.makeResponseBody({
      error,
      code,
      message,
      data,
    });

    switch (this.req.headers.accept) {
      case 'application/octet-stream':
        this.res.status(status).send(msgpackInstance.encode(response));
        break;
      default:
        this.res.status(status).json(response);
        break;
    }

    throw 'API_KILL';
  }

  // Typed send method that enforces response schema
  sendTyped(
    data: TResponse,
    options?: {
      error?: boolean;
      status?: number;
      code?: string;
      message?: string;
    },
  ): never {
    return this.send(data, options);
  }

  status(code: number): void {
    this.res.sendStatus(code);
  }

  throw(status: number, options?: { data?: any }): never {
    const { data = undefined } = options ?? {};

    this.send(data, { error: true, status });
  }

  get method() {
    return this.req.method as RouteMethod;
  }

  get body() {
    return this.req._body as TBody;
  }

  get params() {
    return this.req._params as TParams;
  }

  get query() {
    return this.req._query as TQuery;
  }

  get files(): TFiles {
    return (this.req as any)._files as TFiles as TFiles;
  }

  get headers() {
    return this.req.headers;
  }

  get ip() {
    return this.req.clientIp ?? '0.0.0.0';
  }

  get rawPath() {
    return (this.req as any)._parsedUrl.pathname;
  }

  header(key: string, value: string) {
    this.res.set(key, value);
  }

  private makeResponseBody(options: {
    data: any;
    error: boolean;
    code: string;
    message: string;
  }) {
    const { data, error, code, message } = options;

    switch (
      this.server.config.responseDetailLevel as Config['responseDetailLevel']
    ) {
      case 'full':
        return {
          error,
          code,
          message,
          duration: Math.max(
            1,
            new Date().getTime() - this.req.startedAt.getTime(),
          ),
          route: this.route
            ? {
                path: this.route.path,
                methods: this.route.methods,
              }
            : {
                path: this.req.path,
                methods: [],
              },
          data,
        };
      case 'mid':
        return {
          error,
          code,
          message,
          data,
        };
      case 'low':
        return {
          error,
          data,
        };
      case 'blank':
        return data;
    }
  }
}
