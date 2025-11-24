# Lixqa API Server

> **Note**: This is a "private" framework for internal use in Lixqa's projects and is not intended for the public. Documentation is minimal and the project is still unstable.

A TypeScript-based API server framework for building robust, type-safe REST APIs with built-in authentication, rate limiting, and schema validation.

## Features

- 🚀 **Type-Safe**: Full TypeScript support with automatic type inference
- 🔐 **Authentication**: Built-in authentication system with customizable auth methods
- ⚡ **Rate Limiting**: Configurable rate limiting per endpoint with multiple scopes
- 📝 **Schema Validation**: Zod-based request/response validation
- 📤 **File Uploads**: Built-in multipart/form-data with schema-based file validation
- 🛡️ **Error Handling**: Comprehensive error handling and logging
- 📊 **Request Tracking**: Built-in request timing and monitoring
- 🔧 **Flexible Configuration**: Highly configurable server settings

## Installation

```bash
npm install @lixqa-api/server
```

## Quick Start

### 1. Create your context file

```typescript
// context.ts
import { createApp } from '@lixqa-api/server';

// Define your authentication method
const mockCheckUser = ({ token }) => {
  if (token === '123') {
    return {
      id: 1,
      username: 'Lixqa',
      email: 'lixqa@dev.dev',
    };
  }
  return null;
};

const { server, defineRoute, defineMiddleware } = createApp({
  authenticationMethod: mockCheckUser,
  routesBasePath: './routes',
});

export { server, defineRoute, defineMiddleware };
```

### 2. Create your configuration file

```typescript
// lixqa-api.config.ts
import { defineConfig } from '@lixqa-api/server';

export default defineConfig({
  responseDetailLevel: 'full',
  defaults: {
    unauthed: false,
    disabled: false,
    moved: false,
    authOverwrite: null,
  },
  ratelimits: {
    limit: 1,
    remember: 1000,
    punishment: 1000,
    scope: 'ip',
    type: 'endpoint',
    strict: false,
  },
  port: 3000,
  hostname: 'localhost',
});
```

### 3. Create your main application file

```typescript
// index.ts
import { server } from './context.js';

console.log('Server starting...');

await server.init();

console.log('Server initialized');

server.start();

console.log('Server started');
```

### 4. Create route files

Routes are automatically loaded from the `routes` directory. File paths map to URL patterns:

```
routes/
├── users/
│   ├── [userId]/
│   │   ├── _.ts              # GET /users/:userId
│   │   └── _.schema.ts       # Schema for the route
│   └── _.ts                  # GET /users
├── posts/
│   └── [postId]/
│       └── _.ts              # GET /posts/:postId
└── _.ts                      # GET / (root)
```

**Example route file: `routes/users/[userId]/_.ts`**

```typescript
import { defineRoute } from '../context.js';

export default defineRoute({
  GET: async (api) => {
    const { userId } = api.params;
    const { include } = api.query;

    // Your business logic here
    const user = await getUserById(userId);

    // Type-safe response
    api.sendTyped({
      id: user.id,
      name: user.name,
      email: user.email,
    });
  },
  PUT: async (api) => {
    const { userId } = api.params;
    const userData = api.body;

    const updatedUser = await updateUser(userId, userData);
    api.sendTyped(updatedUser);
  },
});
```

**Example schema file: `routes/users/[userId]/_.schema.ts`**

```typescript
import { defineSchema } from '@lixqa-api/server';
import { z } from 'zod';

export default defineSchema({
  params: z.object({
    userId: z.string(),
  }),
  GET: {
    query: z.object({
      include: z.string().optional(),
    }),
    response: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
    }),
  },
  PUT: {
    body: z.object({
      name: z.string().optional(),
      email: z.string().email().optional(),
    }),
    response: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
    }),
  },
});
```

## File-Based Routing

The framework uses a file-based routing system where routes are automatically discovered from the `routes` directory. The file structure maps directly to URL patterns:

### File Path to URL Mapping

| File Path                             | URL Pattern               | Description           |
| ------------------------------------- | ------------------------- | --------------------- |
| `routes/_.ts`                         | `/`                       | Root route            |
| `routes/users/_.ts`                   | `/users`                  | Users list route      |
| `routes/users/[userId]/_.ts`          | `/users/:userId`          | User detail route     |
| `routes/posts/[postId]/comments/_.ts` | `/posts/:postId/comments` | Nested resource route |
| `routes/(admin)/users/_.ts`           | `/users`                  | Admin users route (group ignored) |
| `routes/api/v1/users/_.ts`            | `/api/v1/users`           | Versioned API route   |

### Route Files

- **Route handlers**: Files ending in `.ts` (but not `.schema.ts` or `.middleware.ts` or `.mw.ts`)
- **Schema files**: Files ending in `.schema.ts`
- **Middleware files**: Files ending in `.middleware.ts`, `.mw.ts`, or named `#.ts`
- **Index routes**: Use `_.ts` for directory index routes
- **Dynamic parameters**: Use `[paramName]` for URL parameters
- **Route groups**: Use folders wrapped in parentheses like `(group)` to organize routes without affecting URLs

### Route File Structure

Each route file should export a default object with HTTP method handlers. Routes import `defineRoute` from your context file:

```typescript
import { defineRoute } from '../context.js';

export default defineRoute({
  // Optional: Route-specific settings
  settings: {
    unauthed: false,
    disabled: false,
  },

  // Optional: Route-specific rate limits
  ratelimits: {
    limit: 50,
    remember: 60000,
  },

  // HTTP method handlers
  GET: async (api) => {
    // Handle GET requests
  },
  POST: async (api) => {
    // Handle POST requests
  },
  // ... other methods
});
```

## Middleware

Middleware files are automatically discovered from the `routes` directory and executed on **every request** (including 404s) before route handlers. They run after request parsing but before route-specific logic like authentication and schema validation.

### Middleware File Naming

Middleware files can use any of these naming conventions:

- `*.middleware.ts` - Explicit and clear (recommended)
- `*.mw.ts` - Shorter alternative
- `#.ts` - Minimal naming

All three naming patterns are functionally identical - choose based on your preference and project structure.

### Creating Middleware

Middleware files should export a default object using `defineMiddleware` from your context file:

```typescript
// routes/logging.middleware.ts
import { defineMiddleware } from '../context.js';

export default defineMiddleware({
  fn: async (api) => {
    console.log(`[${new Date().toISOString()}] ${api.method} ${api.rawPath}`);
    console.log(`IP: ${api.ip}`);
  }
});
```

```typescript
// routes/auth.mw.ts (using shorter naming)
import { defineMiddleware } from '../context.js';

export default defineMiddleware({
  fn: async (api) => {
    // Add custom headers
    api.header('X-Request-ID', crypto.randomUUID());
    
    // Access authentication (if available)
    if (api.authentication) {
      console.log('Authenticated user:', api.authentication);
    }
  }
});
```

```typescript
// routes/#.ts (minimal naming)
import { defineMiddleware } from '../context.js';

export default defineMiddleware({
  fn: (api) => {
    // Simple synchronous middleware
    if (api.method === 'OPTIONS') {
      api.send({}, { status: 200 });
    }
  }
});
```

### Middleware Execution Order

Middleware files are executed in **alphabetical order by file path**. This allows you to control execution order through naming:

```
routes/
├── 01-logging.middleware.ts    # Executes first
├── 02-auth.middleware.ts        # Executes second
├── 03-rate-limit.middleware.ts  # Executes third
└── users/
    └── _.ts                     # Route handler
```

### Middleware Features

- **Full API Context**: Middleware has access to the complete API context including `api.authentication`, `api.services`, `api.body`, `api.params`, `api.query`, etc.
- **Early Termination**: Middleware can call `api.send()` or `api.throw()` to stop the request before it reaches route handlers
- **Async Support**: Middleware functions can be async/await
- **Error Handling**: Errors in middleware are caught and handled by your `onError` callback

### Middleware Examples

**Request Logging:**
```typescript
export default defineMiddleware({
  fn: async (api) => {
    const startTime = Date.now();
    // Request will continue to route handler
    // (You could also store startTime on api object for later use)
  }
});
```

**Authentication Check:**
```typescript
export default defineMiddleware({
  fn: async (api) => {
    // Skip authentication check for certain paths
    if (api.rawPath.startsWith('/public')) {
      return; // Continue to next middleware/route
    }
    
    // Require authentication for other routes
    if (!api.authentication) {
      api.throw(401); // Stop request here
    }
  }
});
```

**Request ID Injection:**
```typescript
export default defineMiddleware({
  fn: (api) => {
    const requestId = crypto.randomUUID();
    api.header('X-Request-ID', requestId);
    // Add to request object for later use
    (api as any).requestId = requestId;
  }
});
```

**Rate Limiting (Custom):**
```typescript
export default defineMiddleware({
  fn: async (api) => {
    // Custom rate limiting logic
    const key = `rate:${api.ip}`;
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, 60);
    }
    if (count > 100) {
      api.throw(429, { data: 'Too many requests' });
    }
  }
});
```

### Organizing Middleware

You can organize middleware in subdirectories within the routes folder:

```
routes/
├── #.ts                          # Global middleware
├── api/
│   ├── v1/
│   │   └── auth.mw.ts           # API v1 specific middleware
│   └── v2/
│       └── auth.mw.ts           # API v2 specific middleware
├── admin/
│   └── permissions.mw.ts        # Admin-specific middleware
└── users/
    └── [userId]/
        └── ownership.mw.ts      # Route-specific middleware
```

All middleware files are discovered recursively and executed in alphabetical order by their full file path.

## Route Groups

Route groups allow you to organize routes in folders without affecting the URL structure. Folders wrapped in parentheses `(groupName)` are ignored when converting file paths to route URLs.

### How Route Groups Work

Route groups are folders that start with `(` and end with `)`. These folders are used purely for organization and don't appear in the final URL path.

### Examples

| File Path                              | URL Pattern      | Description                                    |
| -------------------------------------- | ---------------- | ---------------------------------------------- |
| `routes/(admin)/users/_.ts`           | `/users`         | Admin routes (group ignored in URL)            |
| `routes/(api)/v1/posts/_.ts`          | `/v1/posts`      | API versioning group (ignored)                |
| `routes/(auth)/login/_.ts`             | `/login`          | Authentication routes group                    |
| `routes/(admin)/users/(settings)/_.ts` | `/users`          | Nested groups (both ignored)                   |

### Use Cases for Route Groups

**1. Organizing by Feature:**
```
routes/
├── (auth)/
│   ├── login/_.ts
│   ├── register/_.ts
│   └── logout/_.ts
├── (admin)/
│   ├── users/_.ts
│   └── settings/_.ts
└── (public)/
    ├── about/_.ts
    └── contact/_.ts
```

**2. API Versioning:**
```
routes/
├── (api)/
│   ├── v1/
│   │   └── users/_.ts      # /v1/users
│   └── v2/
│       └── users/_.ts      # /v2/users
```

**3. Route Organization Without URL Impact:**
```
routes/
├── (legacy)/
│   └── old-endpoint/_.ts   # /old-endpoint (not /legacy/old-endpoint)
└── (new)/
    └── new-endpoint/_.ts   # /new-endpoint
```

### Route Groups with Middleware

You can place middleware files inside route groups:

```
routes/
├── (admin)/
│   ├── permissions.middleware.ts  # Admin middleware
│   └── users/
│       └── _.ts                   # /users route
└── (public)/
    └── #.ts                        # Public middleware
```

The middleware will still execute on all requests (they're not scoped to the group), but organizing them in groups helps with code organization.

## API Reference

### `createApp(options)`

Creates a new API application instance.

**Parameters:**

- `authenticationMethod`: Function to authenticate tokens
- `routesBasePath`: Path to your route files

### `defineConfig(config)`

Defines the server configuration. The framework automatically looks for `lixqa-api.config.ts` in your project root.

**Configuration Options:**

```typescript
interface Config {
  port: number;
  hostname: string;
  responseDetailLevel: 'full' | 'mid' | 'low' | 'blank';
  defaults: RouteSettings;
  ratelimits: RouteRatelimits;
  upload?: {
    store: 'memory' | 'disk';
    diskPath?: string;
  };
}
```

**Example:**

```typescript
import { defineConfig } from '@lixqa-api/server';

export default defineConfig({
  port: 3000,
  hostname: 'localhost',
  responseDetailLevel: 'full',
  defaults: {
    unauthed: false,
    disabled: false,
    moved: false,
    authOverwrite: null,
  },
  ratelimits: {
    limit: 1,
    remember: 1000,
    punishment: 1000,
    scope: 'ip',
    type: 'endpoint',
    strict: false,
  },
});
```

### `defineRoute(route)`

Defines a route with handlers for different HTTP methods.

**Route Definition:**

```typescript
{
  schema?: SchemaDefinition;
  settings?: RouteSettings;
  ratelimits?: RouteRatelimits;
  GET?: (api: API) => void;
  POST?: (api: API) => void;
  PUT?: (api: API) => void;
  DELETE?: (api: API) => void;
  PATCH?: (api: API) => void;
}
```

### `defineMiddleware(middleware)`

Defines a middleware function that runs on every request. Must be obtained from `createApp` to maintain type safety.

**Middleware Definition:**

```typescript
{
  fn: (api: API<unknown, unknown, unknown, unknown, TAuth, TServices>) => void | Promise<void>;
}
```

**Example:**

```typescript
import { defineMiddleware } from '../context.js';

export default defineMiddleware({
  fn: async (api) => {
    // Middleware logic
    console.log(`Request: ${api.method} ${api.rawPath}`);
    
    // Can stop request early
    if (someCondition) {
      api.throw(403);
    }
  }
});
```

### `defineSchema(schema)`

Defines a Zod schema for request/response validation.

**Schema Structure:**

```typescript
{
  params?: z.ZodTypeAny;
  GET?: {
    query?: z.ZodTypeAny;
    response?: z.ZodTypeAny;
  };
  POST?: {
    query?: z.ZodTypeAny;
    body?: z.ZodTypeAny;
    files?: z.ZodTypeAny; // File validation schema
    response?: z.ZodTypeAny;
  };
  // ... other methods
}
```

## Configuration

### Server Configuration

````typescript
interface Config {
  port: number;
  hostname: string;
  responseDetailLevel: 'full' | 'mid' | 'low' | 'blank';
  defaults: RouteSettings;
  ratelimits: RouteRatelimits;
  upload?: {
    store: 'memory' | 'disk';
    diskPath?: string;
  };
}

## File Uploads

### Global or Per-Route Upload Settings

```ts
// lixqa-api.config.ts
export default defineConfig({
  // ...
  upload: {
    store: 'memory', // or 'disk'
    diskPath: './uploads',
  },
});

// In a route (overrides global)
export default defineRoute({
  settings: {
    POST: {
      upload: { store: 'disk', diskPath: './uploads/images' },
    },
  },
});
````

### Validating Files with Zod Helpers

```ts
import { defineSchema, z, zFileSchema } from '@lixqa-api/server';

export default defineSchema({
  POST: {
    body: z.object({ title: z.string() }),
    files: zFileSchema
      .builder()
      .required()
      .multiple()
      .maxFiles(5)
      .maxSize(10 * 1024 * 1024)
      .mimeTypes(['image/jpeg', 'image/png'])
      .extensions(['.jpg', '.jpeg', '.png'])
      .build(),
  },
});
```

### Accessing Files in Handlers

```ts
export default defineRoute({
  POST: (api) => {
    const files = api.files; // single file or array depending on schema
    api.send({ uploaded: Array.isArray(files) ? files.length : files ? 1 : 0 });
  },
});
```

````

### Route Settings

```typescript
interface RouteSettings {
  unauthed: boolean; // Allow unauthenticated access
  disabled: boolean; // Disable the route
  moved: boolean; // Mark route as moved
  authOverwrite: Function | null; // Custom auth logic
}
````

### Rate Limiting

```typescript
interface RouteRatelimits {
  limit: number; // Request limit
  remember: number; // Time window (ms)
  punishment: number; // Punishment duration (ms)
  strict: boolean; // Strict mode
  type: 'endpoint' | 'parameter';
  scope: 'ip' | 'authentication' | 'global';
}
```

## Development

### Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build the project
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

### Project Structure

```
your-project/
├── context.ts             # App context with server, defineRoute, defineMiddleware
├── index.ts               # Main application file
├── lixqa-api.config.ts    # Server configuration
├── routes/                # File-based routes
│   ├── _.ts              # Root route (/)
│   ├── #.ts              # Global middleware
│   ├── logging.middleware.ts  # Logging middleware
│   ├── (admin)/          # Route group (ignored in URL)
│   │   └── users/
│   │       └── _.ts      # /users (not /admin/users)
│   ├── users/
│   │   ├── _.ts          # Users list (/users)
│   │   ├── [userId]/
│   │   │   ├── _.ts      # User detail (/users/:userId)
│   │   │   └── _.schema.ts # User schema
│   │   └── auth.mw.ts    # User-specific middleware
│   └── posts/
│       └── [postId]/
│           └── _.ts      # Post detail (/posts/:postId)
└── package.json
```

**Framework Structure:**

```
src/
├── lib/
│   ├── create-app.ts      # App creation
│   ├── define-route.ts    # Route definition
│   ├── define-schema.ts   # Schema definition
│   ├── helpers/           # Utility functions
│   ├── managers/          # Core managers (routes, schemas)
│   ├── structures/        # Core structures (server, route, schema)
│   └── typings/           # Type definitions
```

## License

ISC

## Author

Lixqa <lixqadev@gmail.com>

## Repository

[GitHub Repository](https://github.com/lixqa/lixqa-api)
