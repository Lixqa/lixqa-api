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

  validate(files: any): { valid: boolean; errors: string[]; files: any[] } {
    const errors: string[] = [];
    const fileArray = this.normalizeFiles(files);

    if (this.options.required && fileArray.length === 0) {
      errors.push('Files are required');
      return { valid: false, errors, files: [] };
    }

    if (!this.options.multiple && fileArray.length > 1) {
      errors.push('Only one file is allowed');
      return { valid: false, errors, files: [] };
    }

    if (fileArray.length > this.options.maxFiles) {
      errors.push(`Maximum ${this.options.maxFiles} files allowed`);
      return { valid: false, errors, files: [] };
    }

    for (const file of fileArray) {
      this.validateSingleFile(file, errors);
    }

    return {
      valid: errors.length === 0,
      errors,
      files: fileArray,
    };
  }

  private normalizeFiles(files: any): any[] {
    if (!files) return [];
    if (Array.isArray(files)) return files;
    return [files];
  }

  private validateSingleFile(file: any, errors: string[]): void {
    if (this.options.maxSize && file.size > this.options.maxSize) {
      errors.push(
        `File ${file.originalname} exceeds maximum size of ${this.formatBytes(this.options.maxSize)}`,
      );
    }

    if (
      this.options.allowedMimeTypes.length > 0 &&
      !this.options.allowedMimeTypes.includes(file.mimetype)
    ) {
      errors.push(
        `File ${file.originalname} has invalid MIME type: ${file.mimetype}`,
      );
    }

    if (this.options.allowedExtensions.length > 0) {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!this.options.allowedExtensions.includes(ext)) {
        errors.push(`File ${file.originalname} has invalid extension: ${ext}`);
      }
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export const createFileSchema = (options: FileValidationOptions = {}) => {
  const validator = new FileValidator(options);
  return z.custom(
    (val) => {
      const result = validator.validate(val);
      return result.valid;
    },
    {
      message: `File validation failed`,
    },
  );
};

export const zFile = (options: FileValidationOptions = {}) => {
  const schema = z.custom(
    (val) => {
      const validator = new FileValidator(options);
      const result = validator.validate(val);
      return result.valid;
    },
    {
      message: `File validation failed`,
    },
  );
  (schema as any).__fileOptions = options;
  return schema;
};

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
    return zFile(this.options);
  }
}

export const zFileSchema = {
  file: (options: FileValidationOptions = {}) => zFile(options),
  image: (options: FileValidationOptions = {}) =>
    zFile({ ...FileValidationPresets.image, ...options }),
  document: (options: FileValidationOptions = {}) =>
    zFile({ ...FileValidationPresets.document, ...options }),
  video: (options: FileValidationOptions = {}) =>
    zFile({ ...FileValidationPresets.video, ...options }),
  audio: (options: FileValidationOptions = {}) =>
    zFile({ ...FileValidationPresets.audio, ...options }),
  builder: (options: FileValidationOptions = {}) =>
    new FileSchemaBuilder(options),
  requiredImage: (options: FileValidationOptions = {}) =>
    zFile({ ...FileValidationPresets.image, ...options, required: true }),
  requiredDocument: (options: FileValidationOptions = {}) =>
    zFile({ ...FileValidationPresets.document, ...options, required: true }),
  multipleImages: (options: FileValidationOptions = {}) =>
    zFile({ ...FileValidationPresets.image, ...options, multiple: true }),
  multipleDocuments: (options: FileValidationOptions = {}) =>
    zFile({ ...FileValidationPresets.document, ...options, multiple: true }),
};

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
