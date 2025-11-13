import type {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';
import { API } from '../structures/api';
import type { UploadedFile } from './common';

/**
 * Extended Express Request with API context
 */
export interface Request<TAuth = any, TServices = undefined>
  extends ExpressRequest {
  startedAt: Date;
  api: API<unknown, unknown, unknown, unknown, TAuth, TServices, unknown>;
  _body: any;
  _params: {
    [key: string]: string;
  };
  _query: {
    [key: string]: string;
  };
  _files?: UploadedFile[];
  _filesRaw?: UploadedFile[];
}

/**
 * Express Response type
 */
export type Response = ExpressResponse;

