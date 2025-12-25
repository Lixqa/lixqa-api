import { z } from 'zod';
import type { RouteMethod } from './common';
import type { UploadedFile } from './common';

/**
 * A type that represents either a Zod schema or a plain object with Zod schema properties.
 * For query and params, we allow plain objects since they must always be objects.
 */
type ZodObjectOrPlainObject<T extends z.ZodTypeAny = z.ZodTypeAny> = 
  | T 
  | { [key: string]: z.ZodTypeAny };

/**
 * Schema definition structure for route validation
 */
export type SchemaDefinition = Partial<{
  params: ZodObjectOrPlainObject<z.ZodObject<any, any>>;
}> &
  Partial<{
    [M in RouteMethod]: M extends 'GET'
      ? { query?: ZodObjectOrPlainObject<z.ZodObject<any, any>>; response?: z.ZodTypeAny }
      : {
          query?: ZodObjectOrPlainObject<z.ZodObject<any, any>>;
          body?: z.ZodTypeAny;
          files?: z.ZodTypeAny;
          response?: z.ZodTypeAny;
        };
  }>;

/**
 * Helper to extract inferred type from a Zod schema or plain object
 */
type InferZodType<T> = T extends z.ZodTypeAny 
  ? z.infer<T> 
  : T extends { [key: string]: z.ZodTypeAny }
    ? z.infer<z.ZodObject<{ [K in keyof T]: T[K] }>>
    : unknown;

/**
 * Extract params type from schema definition
 */
type ExtractParams<V> = V extends { params: infer T }
  ? InferZodType<T>
  : unknown;

/**
 * Extract body type from schema definition for a specific method
 */
type ExtractBody<V, M extends RouteMethod> = M extends 'GET'
  ? unknown
  : V extends { [K in M]: { body: infer T } }
    ? InferZodType<T>
    : unknown;

/**
 * Extract query type from schema definition for a specific method
 */
type ExtractQuery<V, M extends RouteMethod> = V extends {
  [K in M]: { query: infer T };
}
  ? InferZodType<T>
  : unknown;

/**
 * Extract response type from schema definition for a specific method
 */
type ExtractResponse<V, M extends RouteMethod> = V extends {
  [K in M]: { response: infer T };
}
  ? InferZodType<T>
  : unknown;

/**
 * Extract files type from schema definition for a specific method
 */
type ExtractFiles<V, M extends RouteMethod> = V extends {
  [K in M]: { files: z.ZodTypeAny };
}
  ? UploadedFile[]
  : unknown;

/**
 * Get schema type for a specific key (body, params, query, response, files)
 */
export type GetSchemaType<
  V,
  M extends RouteMethod,
  K extends 'body' | 'params' | 'query' | 'response' | 'files',
> = V extends object
  ? K extends 'params'
    ? ExtractParams<V>
    : K extends 'body'
      ? ExtractBody<V, M>
      : K extends 'query'
        ? ExtractQuery<V, M>
        : K extends 'response'
          ? ExtractResponse<V, M>
          : K extends 'files'
            ? ExtractFiles<V, M>
            : unknown
  : unknown;

