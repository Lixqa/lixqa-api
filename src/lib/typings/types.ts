import { API } from '../../lib/structures/api';
import { z } from 'zod';
import type {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';

export type RouteMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export type RouteSettings<TAuth = any, TServices = undefined> = {
  unauthed: boolean;
  disabled: boolean;
  moved: boolean;
  authOverwrite:
    | ((
        api: API<unknown, unknown, unknown, unknown, TAuth, TServices>,
      ) => boolean | Promise<boolean>)
    | null;
  upload?: {
    store: 'memory' | 'disk';
    diskPath?: string;
  } | null;
};

export type RouteRatelimits = {
  limit: number;
  remember: number;
  punishment: number;
  strict: boolean;
  type: 'endpoint' | 'parameter';
  scope: 'ip' | 'authentication' | 'global';
};

export type SchemaDefinition = Partial<{
  params: z.ZodTypeAny;
}> &
  Partial<{
    [M in RouteMethod]: M extends 'GET'
      ? { query?: z.ZodTypeAny; response?: z.ZodTypeAny }
      : {
          query?: z.ZodTypeAny;
          body?: z.ZodTypeAny;
          files?: z.ZodTypeAny;
          response?: z.ZodTypeAny;
        };
  }>;

// Helper type to check if response schema exists
type HasResponseSchema<V, M extends RouteMethod> = V extends {
  [K in M]: { response: z.ZodTypeAny };
}
  ? true
  : false;

// API type with deprecated send method (when sendTyped is available)
type APIDeprecatedSend<
  TBody = unknown,
  TParams = unknown,
  TQuery = unknown,
  TResponse = unknown,
  TAuth = any,
  TServices = undefined,
> = Omit<API<TBody, TParams, TQuery, TResponse, TAuth, TServices>, 'send'> & {
  /**
   * @deprecated Use sendTyped instead for type-safe responses when a response schema is defined
   */
  send(
    data?: any,
    options?: {
      error?: boolean;
      status?: number;
      code?: string;
      message?: string;
    },
  ): never;
};

// Conditional API type that includes sendTyped only when response schema exists
export type ConditionalAPI<
  V,
  M extends RouteMethod,
  TAuth = any,
  TServices = undefined,
> =
  HasResponseSchema<V, M> extends true
    ? APIDeprecatedSend<
        GetSchemaType<V, M, 'body'>,
        GetSchemaType<V, M, 'params'>,
        GetSchemaType<V, M, 'query'>,
        GetSchemaType<V, M, 'response'>,
        TAuth,
        TServices
      >
    : Omit<
        API<
          GetSchemaType<V, M, 'body'>,
          GetSchemaType<V, M, 'params'>,
          GetSchemaType<V, M, 'query'>,
          GetSchemaType<V, M, 'response'>,
          TAuth,
          TServices
        >,
        'sendTyped'
      >;

export type RouteDefinition<
  V extends SchemaDefinition = object,
  TAuth = any,
  TServices = undefined,
> = Partial<{
  [M in RouteMethod]: (api: ConditionalAPI<V, M, TAuth, TServices>) => void;
}> & {
  schema?: V;
  settings?: Partial<RouteSettings<TAuth, TServices>> & {
    [M in RouteMethod]?: Partial<RouteSettings<TAuth, TServices>>;
  };
  ratelimits?: Partial<RouteRatelimits> & {
    [M in RouteMethod]?: Partial<RouteRatelimits>;
  };
};

// Helper types to extract schema types more reliably
type ExtractParams<V> = V extends { params: infer T }
  ? T extends z.ZodTypeAny
    ? z.infer<T>
    : unknown
  : unknown;

type ExtractBody<V, M extends RouteMethod> = M extends 'GET'
  ? unknown
  : V extends { [K in M]: { body: infer T } }
    ? T extends z.ZodTypeAny
      ? z.infer<T>
      : unknown
    : unknown;

type ExtractQuery<V, M extends RouteMethod> = V extends {
  [K in M]: { query: infer T };
}
  ? T extends z.ZodTypeAny
    ? z.infer<T>
    : unknown
  : unknown;

type ExtractResponse<V, M extends RouteMethod> = V extends {
  [K in M]: { response: infer T };
}
  ? T extends z.ZodTypeAny
    ? z.infer<T>
    : unknown
  : unknown;

export type GetSchemaType<
  V,
  M extends RouteMethod,
  K extends 'body' | 'params' | 'query' | 'response',
> = V extends object
  ? K extends 'params'
    ? ExtractParams<V>
    : K extends 'body'
      ? ExtractBody<V, M>
      : K extends 'query'
        ? ExtractQuery<V, M>
        : K extends 'response'
          ? ExtractResponse<V, M>
          : unknown
  : unknown;

export type Config<TAuth = any, TServices = undefined> = {
  port: number;
  hostname: string;
  responseDetailLevel: 'full' | 'mid' | 'low' | 'blank';
  defaults: RouteSettings<TAuth, TServices>;
  ratelimits: RouteRatelimits;
  upload?: {
    store: 'memory' | 'disk';
    diskPath?: string;
  };
};

export interface Request<TAuth = any, TServices = undefined>
  extends ExpressRequest {
  startedAt: Date;
  api: API<unknown, unknown, unknown, unknown, TAuth, TServices>;
  _body: any;
  _params: {
    [key: string]: string;
  };
  _query: {
    [key: string]: string;
  };
  _files?: any;
}

export type Response = ExpressResponse;
