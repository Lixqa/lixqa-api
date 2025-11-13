import { z } from 'zod';
import { API } from '../structures/api';
import type { RouteMethod } from './common';
import type { GetSchemaType } from './schema';

/**
 * Check if a response schema exists for a given method
 */
type HasResponseSchema<V, M extends RouteMethod> = V extends {
  [K in M]: { response: z.ZodTypeAny };
}
  ? true
  : false;

/**
 * API type with deprecated send method (when sendTyped is available)
 */
type APIDeprecatedSend<
  TBody = unknown,
  TParams = unknown,
  TQuery = unknown,
  TResponse = unknown,
  TAuth = any,
  TServices = undefined,
  TFiles = unknown,
> = Omit<
  API<TBody, TParams, TQuery, TResponse, TAuth, TServices, TFiles>,
  'send'
> & {
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

/**
 * Conditional API type that includes sendTyped only when response schema exists
 */
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
        TServices,
        GetSchemaType<V, M, 'files'>
      >
    : Omit<
        API<
          GetSchemaType<V, M, 'body'>,
          GetSchemaType<V, M, 'params'>,
          GetSchemaType<V, M, 'query'>,
          GetSchemaType<V, M, 'response'>,
          TAuth,
          TServices,
          GetSchemaType<V, M, 'files'>
        >,
        'sendTyped'
      >;
