import chalk from 'chalk';
import { Route } from '../structures/route';
import type { RouteMethod } from '../typings';
import { Logger } from './logger';
import { isZodObject } from './utils';

const ROUTE_METHODS: RouteMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

interface ValidationIssue {
  type: 'error' | 'warning';
  message: string;
}

export interface ValidationResult {
  route: Route;
  issues: ValidationIssue[];
  invalid: boolean;
  isReserved?: boolean;
}

export class RouteValidator {
  private route: Route;
  private issues: ValidationIssue[] = [];
  private invalid = false;
  private reservedPaths: Set<string>;

  constructor(route: Route, reservedPaths: Set<string> = new Set()) {
    this.route = route;
    this.reservedPaths = reservedPaths;
  }

  validate(): ValidationResult {
    this.issues = [];
    this.invalid = false;

    // Check if route is reserved (only warn for user routes, not internal routes)
    // Internal routes have filePath containing 'internal-routes', user routes don't
    const isInternalRoute = this.route.filePath.includes('internal-routes');
    const isReserved = this.reservedPaths.has(this.route.path);
    if (isReserved && !isInternalRoute) {
      this.warn(
        `Route "${this.route.path}" is reserved. Your route will be ignored and the built-in route will be used instead.`,
      );
    }

    // Get available methods (handlers that exist)
    const availableMethods = this.route.methods;

    // Error: No handlers at all
    if (availableMethods.length === 0) {
      this.error(
        'No route handlers found. At least one handler (GET, POST, PUT, DELETE, or PATCH) is required.',
      );
    }

    // Warning: Settings configured for methods without handlers
    if (this.route.file.settings) {
      const configuredMethods = Object.keys(this.route.file.settings).filter(
        (key) => ROUTE_METHODS.includes(key as RouteMethod),
      ) as RouteMethod[];

      const missingHandlers = configuredMethods.filter(
        (method) => !availableMethods.includes(method),
      );

      if (missingHandlers.length > 0) {
        this.warn(
          `Settings are configured for methods without handlers: ${missingHandlers.join(', ')}. Remove the settings or add the handlers.`,
        );
      }
    }

    // Warning: Ratelimits configured for methods without handlers
    if (this.route.file.ratelimits) {
      const configuredMethods = Object.keys(this.route.file.ratelimits).filter(
        (key) => ROUTE_METHODS.includes(key as RouteMethod),
      ) as RouteMethod[];

      const missingHandlers = configuredMethods.filter(
        (method) => !availableMethods.includes(method),
      );

      if (missingHandlers.length > 0) {
        this.warn(
          `Ratelimits are configured for methods without handlers: ${missingHandlers.join(', ')}. Remove the ratelimit settings or add the handlers.`,
        );
      }

      // Validate ratelimit values for all configured methods
      this.validateRatelimits(configuredMethods);
    }

    // Warning: Schema defined for methods without handlers
    if (this.route.schema) {
      const schemaMethods = Object.keys(this.route.schema.file).filter((key) =>
        ROUTE_METHODS.includes(key as RouteMethod),
      ) as RouteMethod[];

      const missingHandlers = schemaMethods.filter(
        (method) => !availableMethods.includes(method),
      );

      if (missingHandlers.length > 0) {
        this.warn(
          `Schema is defined for methods without handlers: ${missingHandlers.join(', ')}. Remove the schema definitions or add the handlers.`,
        );
      }

      // Check for deprecated params schema usage
      this.checkSchemaDeprecations();
    }

    // Warning: Route has handlers but no schema (might be intentional, so just a warning)
    if (availableMethods.length > 0 && !this.route.schema) {
      // This is optional, so we'll make it a lower priority warning
      // Only warn if there are POST/PUT/PATCH methods that typically need validation
      const methodsNeedingValidation = availableMethods.filter((m) =>
        ['POST', 'PUT', 'PATCH'].includes(m),
      );
      if (methodsNeedingValidation.length > 0) {
        this.warn(
          `Route has ${methodsNeedingValidation.join(', ')} handler(s) but no schema file found. Consider adding a schema for request validation.`,
        );
      }
    }

    return {
      route: this.route,
      issues: this.issues,
      invalid: this.invalid,
      isReserved: this.reservedPaths.has(this.route.path),
    };
  }

  private warn(message: string) {
    this.issues.push({ type: 'warning', message });
  }

  private error(message: string) {
    this.issues.push({ type: 'error', message });
    this.invalid = true;
  }

  private validateRatelimits(methods: RouteMethod[]) {
    const globalRatelimits = this.route.file.ratelimits;
    if (!globalRatelimits) return;

    // Check global ratelimits
    this.checkRatelimitValues(globalRatelimits, 'global');

    // Check method-specific ratelimits
    methods.forEach((method) => {
      const methodRatelimits = globalRatelimits[method];
      if (methodRatelimits) {
        // Merge with global for validation
        const merged = {
          ...globalRatelimits,
          ...methodRatelimits,
        };
        this.checkRatelimitValues(merged, method);
      }
    });
  }

  private checkRatelimitValues(
    ratelimits: {
      limit?: number;
      remember?: number;
      punishment?: number;
      strict?: boolean;
      type?: 'endpoint' | 'parameter';
      scope?: 'ip' | 'authentication' | 'global';
    },
    context: RouteMethod | 'global',
  ) {
    const contextStr = context === 'global' ? 'global' : `method ${context}`;

    // Check limit
    if (ratelimits.limit !== undefined) {
      if (ratelimits.limit <= 0) {
        this.warn(
          `Ratelimit limit for ${contextStr} is ${ratelimits.limit}. It should be greater than 0.`,
        );
      } else if (ratelimits.limit > 10000) {
        this.warn(
          `Ratelimit limit for ${contextStr} is very high (${ratelimits.limit}). This may allow excessive requests.`,
        );
      } else if (
        ratelimits.limit === 1 &&
        ratelimits.remember !== undefined &&
        ratelimits.remember > 60000
      ) {
        this.warn(
          `Ratelimit limit for ${contextStr} is 1 with a long remember time (${ratelimits.remember}ms). This may be too restrictive.`,
        );
      }
    }

    // Check remember (time window in milliseconds)
    if (ratelimits.remember !== undefined) {
      if (ratelimits.remember <= 0) {
        this.warn(
          `Ratelimit remember time for ${contextStr} is ${ratelimits.remember}ms. It should be greater than 0.`,
        );
      } else if (ratelimits.remember < 100) {
        this.warn(
          `Ratelimit remember time for ${contextStr} is very short (${ratelimits.remember}ms). This may cause issues with request timing.`,
        );
      } else if (ratelimits.remember > 3600000) {
        // 1 hour
        this.warn(
          `Ratelimit remember time for ${contextStr} is very long (${ratelimits.remember}ms = ${Math.round(ratelimits.remember / 1000 / 60)} minutes). This may keep rate limit data in memory for extended periods.`,
        );
      }
    }

    // Check punishment (ban time in milliseconds)
    if (ratelimits.punishment !== undefined) {
      if (ratelimits.punishment <= 0) {
        this.warn(
          `Ratelimit punishment time for ${contextStr} is ${ratelimits.punishment}ms. It should be greater than 0.`,
        );
      } else if (ratelimits.punishment < 100) {
        this.warn(
          `Ratelimit punishment time for ${contextStr} is very short (${ratelimits.punishment}ms). This may not effectively deter abuse.`,
        );
      } else if (ratelimits.punishment > 86400000) {
        // 24 hours
        this.warn(
          `Ratelimit punishment time for ${contextStr} is very long (${ratelimits.punishment}ms = ${Math.round(ratelimits.punishment / 1000 / 60 / 60)} hours). This may lock out legitimate users.`,
        );
      }

      // Check if punishment is much longer than remember (could be intentional but worth warning)
      if (
        ratelimits.remember !== undefined &&
        ratelimits.punishment > ratelimits.remember * 10
      ) {
        this.warn(
          `Ratelimit punishment time for ${contextStr} (${ratelimits.punishment}ms) is much longer than remember time (${ratelimits.remember}ms). This may be too harsh.`,
        );
      }
    }

    // Check if limit is very high but remember is very short (allows rapid requests)
    if (
      ratelimits.limit !== undefined &&
      ratelimits.remember !== undefined &&
      ratelimits.limit > 100 &&
      ratelimits.remember < 1000
    ) {
      this.warn(
        `Ratelimit for ${contextStr} allows ${ratelimits.limit} requests in ${ratelimits.remember}ms. This may allow rapid-fire requests.`,
      );
    }
  }

  private checkSchemaDeprecations() {
    if (!this.route.schema) return;

    const schema = this.route.schema.file;

    // Check params (query must be z.object() so no deprecation check needed)
    // Only warn if it's explicitly z.object(), not if it was normalized from a plain object
    if (
      schema.params &&
      isZodObject(schema.params) &&
      !(schema.params as any).__normalized
    ) {
      // Add as a warning issue (deprecation warnings are counted as warnings)
      this.warn(
        'Using z.object() for params schema is deprecated. Use a plain object instead: params: { userId: z.string() }',
      );
    }
  }

  static displayValidationResults(
    results: ValidationResult[],
    duplicatePaths: Map<string, string[]>,
  ) {
    // Filter out routes with no issues
    const routesWithIssues = results.filter((r) => r.issues.length > 0);

    // Count warnings and errors for statistics
    let warningCount = 0;
    let errorCount = 0;

    routesWithIssues.forEach((result) => {
      result.issues.forEach((issue) => {
        if (issue.type === 'error') {
          errorCount++;
        } else {
          warningCount++;
        }
      });
    });

    // Count duplicate paths as warnings
    duplicatePaths.forEach((filePaths) => {
      if (filePaths.length > 1) {
        warningCount++;
      }
    });

    // Update startup statistics
    const statsTracker = Logger.getStatsTracker();
    if (statsTracker) {
      statsTracker.warnings += warningCount;
      statsTracker.errors += errorCount;
    }

    // If no issues, return early
    if (routesWithIssues.length === 0 && duplicatePaths.size === 0) {
      return;
    }

    console.log(chalk.gray('\n' + '═'.repeat(60)));
    console.log(chalk.bold.yellow('Route Validation Results'));
    console.log(chalk.gray('═'.repeat(60) + '\n'));

    // Display duplicate paths first
    if (duplicatePaths.size > 0) {
      console.log(chalk.yellow('⚠ Duplicate Route Paths:\n'));
      duplicatePaths.forEach((filePaths, routePath) => {
        if (filePaths.length > 1) {
          console.log(`  ${chalk.yellow('●')} ${chalk.bold(routePath)}`);
          filePaths.forEach((filePath) => {
            console.log(`    ${chalk.gray('└─')} ${chalk.gray(filePath)}`);
          });
          console.log(
            `    ${chalk.yellow('→')} Both routes are disabled due to path conflict.\n`,
          );
        }
      });
    }

    // Sort routes by path for consistent output
    routesWithIssues.sort((a, b) => a.route.path.localeCompare(b.route.path));

    // Display route issues
    if (routesWithIssues.length > 0) {
      console.log(chalk.yellow('Route Issues:\n'));

      routesWithIssues.forEach((result) => {
        // Sort issues: errors first, then warnings
        result.issues.sort((a, b) => {
          if (a.type === 'error' && b.type === 'warning') return -1;
          if (a.type === 'warning' && b.type === 'error') return 1;
          return 0;
        });

        const hasErrors = result.issues.some((i) => i.type === 'error');
        const prefix = hasErrors ? chalk.red('[E]') : chalk.yellow('[W]');

        console.log(`${prefix} ${chalk.bold(result.route.path)}`);

        result.issues.forEach(({ type, message }) => {
          const color = type === 'error' ? chalk.red : chalk.yellow;
          console.log(` ${chalk.gray('└─')} ${color(message)}`);
        });

        const statusColor = result.invalid ? chalk.red : chalk.yellow;
        let statusText: string;
        if (result.isReserved) {
          statusText =
            'The route was ignored. The built-in route will be used instead.';
        } else if (result.invalid) {
          statusText = 'The route is invalid and may not work correctly.';
        } else {
          statusText =
            "The route was loaded. Please don't forget to fix the issues.";
        }

        console.log(` ${chalk.gray('└─')} ${statusColor(statusText)}\n`);
      });
    }

    console.log(chalk.gray('═'.repeat(60) + '\n'));
  }
}
