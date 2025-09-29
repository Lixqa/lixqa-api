# Lixqa API Server

> **Note**: This is a "private" framework for internal use in Lixqa's projects and is not intended for the public. Documentation is minimal and the project is still unstable.

A TypeScript-based API server framework for building robust, type-safe REST APIs with built-in authentication, rate limiting, and schema validation.

## Features

- 🚀 **Type-Safe**: Full TypeScript support with automatic type inference
- 🔐 **Authentication**: Built-in authentication system with customizable auth methods
- ⚡ **Rate Limiting**: Configurable rate limiting per endpoint with multiple scopes
- 📝 **Schema Validation**: Zod-based request/response validation
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
const mockCheckUser = (token: string) => {
  if (token === '123') {
    return {
      id: 1,
      username: 'Lixqa',
      email: 'lixqa@dev.dev',
    };
  }
  return null;
};

const { server, defineRoute } = createApp({
  authenticationMethod: mockCheckUser,
  routesBasePath: './routes',
});

export { server, defineRoute };
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

### Route Files

- **Route handlers**: Files ending in `.ts` (but not `.schema.ts`)
- **Schema files**: Files ending in `.schema.ts`
- **Index routes**: Use `_.ts` for directory index routes
- **Dynamic parameters**: Use `[paramName]` for URL parameters

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
    response?: z.ZodTypeAny;
  };
  // ... other methods
}
```

## Configuration

### Server Configuration

```typescript
interface Config {
  port: number;
  hostname: string;
  responseDetailLevel: 'full' | 'mid' | 'low' | 'blank';
  defaults: RouteSettings;
  ratelimits: RouteRatelimits;
}
```

### Route Settings

```typescript
interface RouteSettings {
  unauthed: boolean; // Allow unauthenticated access
  disabled: boolean; // Disable the route
  moved: boolean; // Mark route as moved
  authOverwrite: Function | null; // Custom auth logic
}
```

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
├── context.ts             # App context with server and defineRoute
├── index.ts               # Main application file
├── lixqa-api.config.ts    # Server configuration
├── routes/                # File-based routes
│   ├── _.ts              # Root route (/)
│   ├── users/
│   │   ├── _.ts          # Users list (/users)
│   │   └── [userId]/
│   │       ├── _.ts      # User detail (/users/:userId)
│   │       └── _.schema.ts # User schema
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
