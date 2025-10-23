import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

export type FileValidationOptions = {
  maxSize?: number;
  allowedMimeTypes?: string[];
  allowedExtensions?: string[];
  required?: boolean;
  multiple?: boolean;
  maxFiles?: number;
};

export class FileValidator {
  private options: Required<FileValidationOptions>;

  constructor(options: FileValidationOptions = {}) {
    this.options = {
      maxSize: 5 * 1024 * 1024,
      allowedMimeTypes: [],
      allowedExtensions: [],
      required: false,
      multiple: false,
      maxFiles: 10,
      ...options,
    };
  }
}

type UploadedFile = {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination?: string;
  filename?: string;
  path?: string;
  buffer?: Buffer;
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function superRefineFiles(
  val: unknown,
  ctx: z.RefinementCtx,
  options: Required<FileValidationOptions>,
) {
  const isArray = Array.isArray(val);
  const isFileObj = !isArray && val && typeof val === 'object';

  if (val == null || (isArray && (val as unknown[]).length === 0)) {
    if (options.required) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Files are required',
      });
    }
    return;
  }

  if (!isArray && !isFileObj) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Invalid file input',
    });
    return;
  }

  const files = (
    isArray ? (val as UploadedFile[]) : [val as UploadedFile]
  ).filter((f) => !!f);

  if (!options.multiple && files.length > 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Only one file is allowed',
    });
  }
  if (files.length > options.maxFiles) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Maximum ${options.maxFiles} files allowed`,
    });
  }

  const checkOne = (file: UploadedFile, pathSuffix: (string | number)[]) => {
    if (options.maxSize && file.size > options.maxSize) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `File ${file.originalname} exceeds maximum size of ${formatBytes(options.maxSize)}`,
        path: pathSuffix,
      });
    }
    if (
      options.allowedMimeTypes.length > 0 &&
      !options.allowedMimeTypes.includes(file.mimetype)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `File ${file.originalname} has invalid MIME type: ${file.mimetype}`,
        path: pathSuffix,
      });
    }
    if (options.allowedExtensions.length > 0) {
      const fileExt = path
        .extname(file.originalname)
        .toLowerCase()
        .replace(/^\./, '');
      const allowedExts = options.allowedExtensions.map((e) =>
        (e || '').toLowerCase().replace(/^\./, ''),
      );
      if (!allowedExts.includes(fileExt)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `File ${file.originalname} has invalid extension: .${fileExt}`,
          path: pathSuffix,
        });
      }
    }
  };

  if (isArray) {
    (val as UploadedFile[]).forEach((f, i) => checkOne(f, [i]));
  } else {
    checkOne(val as UploadedFile, []);
  }
}

export const createFileSchema = (options: FileValidationOptions = {}) => {
  const opts: Required<FileValidationOptions> = {
    maxSize: 5 * 1024 * 1024,
    allowedMimeTypes: [],
    allowedExtensions: [],
    required: false,
    multiple: false,
    maxFiles: 10,
    ...options,
  };

  const schema = z
    .any()
    .superRefine((val, ctx) => superRefineFiles(val, ctx, opts));
  (schema as any).__fileOptions = opts;
  return schema;
};

const zFileBase = (options: FileValidationOptions = {}) => {
  const opts: Required<FileValidationOptions> = {
    maxSize: 5 * 1024 * 1024,
    allowedMimeTypes: [],
    allowedExtensions: [],
    required: false,
    multiple: false,
    maxFiles: 10,
    ...options,
  };
  const schema = z
    .any()
    .superRefine((val, ctx) => superRefineFiles(val, ctx, opts));
  (schema as any).__fileOptions = opts;
  return schema;
};

// Chainable API that returns a Zod schema at every step (no build needed)
export type FileChain = z.ZodTypeAny & {
  required: () => FileChain;
  optional: () => FileChain;
  multiple: () => FileChain;
  maxSize: (size: number) => FileChain;
  maxFiles: (count: number) => FileChain;
  mimeTypes: (types: string[]) => FileChain;
  extensions: (exts: string[]) => FileChain;
};

export function zFileChain(options: FileValidationOptions = {}): FileChain {
  const schema = zFileBase(options) as unknown as FileChain;
  (schema as any).required = () => zFileChain({ ...options, required: true });
  (schema as any).optional = () => zFileChain({ ...options, required: false });
  (schema as any).multiple = () => zFileChain({ ...options, multiple: true });
  (schema as any).maxSize = (size: number) =>
    zFileChain({ ...options, maxSize: size });
  (schema as any).maxFiles = (count: number) =>
    zFileChain({ ...options, maxFiles: count });
  (schema as any).mimeTypes = (types: string[]) =>
    zFileChain({ ...options, allowedMimeTypes: types });
  (schema as any).extensions = (exts: string[]) =>
    zFileChain({ ...options, allowedExtensions: exts });
  return schema;
}

class FileSchemaBuilder {
  private options: FileValidationOptions = {};

  constructor(options: FileValidationOptions = {}) {
    this.options = options;
  }

  required() {
    this.options.required = true;
    return this;
  }

  optional() {
    this.options.required = false;
    return this;
  }

  multiple() {
    this.options.multiple = true;
    return this;
  }

  maxSize(size: number) {
    this.options.maxSize = size;
    return this;
  }

  maxFiles(count: number) {
    this.options.maxFiles = count;
    return this;
  }

  mimeTypes(types: string[]) {
    this.options.allowedMimeTypes = types;
    return this;
  }

  extensions(exts: string[]) {
    this.options.allowedExtensions = exts;
    return this;
  }

  build() {
    return zFileBase(this.options);
  }
}

export const zFile = Object.assign(zFileBase, {
  file: (options: FileValidationOptions = {}) => zFileBase(options),
  image: (options: FileValidationOptions = {}) =>
    zFileBase({ ...FileValidationPresets.image, ...options }),
  document: (options: FileValidationOptions = {}) =>
    zFileBase({ ...FileValidationPresets.document, ...options }),
  video: (options: FileValidationOptions = {}) =>
    zFileBase({ ...FileValidationPresets.video, ...options }),
  audio: (options: FileValidationOptions = {}) =>
    zFileBase({ ...FileValidationPresets.audio, ...options }),
  builder: (options: FileValidationOptions = {}) =>
    new FileSchemaBuilder(options),
  chain: (options: FileValidationOptions = {}) => zFileChain(options),
  required: (options: FileValidationOptions = {}) =>
    zFileChain({ ...options, required: true }),
  multiple: (options: FileValidationOptions = {}) =>
    zFileChain({ ...options, multiple: true }),
  optional: (options: FileValidationOptions = {}) =>
    zFileChain({ ...options, required: false }),
  maxSize: (size: number) => zFileChain({ maxSize: size }),
  maxFiles: (count: number) => zFileChain({ maxFiles: count }),
  mimeTypes: (types: string[]) => zFileChain({ allowedMimeTypes: types }),
  extensions: (exts: string[]) => zFileChain({ allowedExtensions: exts }),
});

export const zFileSchema = zFile;

export const createMulterStorage = (config: {
  store: 'memory' | 'disk';
  diskPath?: string;
}) => {
  if (config.store === 'memory') {
    return multer.memoryStorage();
  }
  const diskPath = config.diskPath || './uploads';
  if (!fs.existsSync(diskPath)) {
    fs.mkdirSync(diskPath, { recursive: true });
  }
  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, diskPath);
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(
        null,
        file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname),
      );
    },
  });
};

export const FileValidationPresets = {
  image: {
    maxSize: 10 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  },
  document: {
    maxSize: 50 * 1024 * 1024,
    allowedMimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    allowedExtensions: ['.pdf', '.doc', '.docx'],
  },
  video: {
    maxSize: 500 * 1024 * 1024,
    allowedMimeTypes: ['video/mp4', 'video/avi', 'video/mov', 'video/wmv'],
    allowedExtensions: ['.mp4', '.avi', '.mov', '.wmv'],
  },
  audio: {
    maxSize: 100 * 1024 * 1024,
    allowedMimeTypes: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3'],
    allowedExtensions: ['.mp3', '.wav', '.ogg'],
  },
};
