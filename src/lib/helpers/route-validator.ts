import chalk from 'chalk';
import { Route } from '../structures/route';
import { Logger } from './logger';
import type { RouteMethod } from '../typings';

const ROUTE_METHODS: RouteMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

interface ValidationIssue {
  type: 'error' | 'warning';
  message: string;
}

export class RouteValidator {
  private route: Route;
  private issues: ValidationIssue[] = [];
  private invalid = false;

  constructor(route: Route) {
    this.route = route;
  }

  validate(): boolean {
    this.issues = [];
    this.invalid = false;

    // Get available methods (handlers that exist)
    const availableMethods = this.route.methods;

    // Error: No handlers at all
    if (availableMethods.length === 0) {
      this.error('No route handlers found. At least one handler (GET, POST, PUT, DELETE, or PATCH) is required.');
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
      const schemaMethods = Object.keys(this.route.schema.file).filter(
        (key) => ROUTE_METHODS.includes(key as RouteMethod),
      ) as RouteMethod[];

      const missingHandlers = schemaMethods.filter(
        (method) => !availableMethods.includes(method),
      );

      if (missingHandlers.length > 0) {
        this.warn(
          `Schema is defined for methods without handlers: ${missingHandlers.join(', ')}. Remove the schema definitions or add the handlers.`,
        );
      }
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

    // Display issues
    this.dump();

    return !this.invalid;
  }

  private warn(message: string) {
    this.issues.push({ type: 'warning', message });
    Logger.warning(message, this.route.path);
  }

  private error(message: string) {
    this.issues.push({ type: 'error', message });
    Logger.error(`[${this.route.path}] ${message}`);
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
      } else if (ratelimits.limit === 1 && ratelimits.remember > 60000) {
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

  private dump() {
    if (this.issues.length === 0) return;

    // Sort: errors first, then warnings
    this.issues.sort((a, b) => {
      if (a.type === 'error' && b.type === 'warning') return -1;
      if (a.type === 'warning' && b.type === 'error') return 1;
      return 0;
    });

    console.log(chalk.red(`[E] ${chalk.bold(this.route.path)}`));
    this.issues.forEach(({ type, message }) => {
      const color = type === 'error' ? chalk.red : chalk.yellow;
      console.log(` ${chalk.red('╠═●')} ${color(message)}`);
    });
    console.log(
      `${chalk.red(' ║\n ╚═»')} ${
        this.invalid
          ? chalk.underline.red('The route is invalid and may not work correctly.')
          : chalk.underline.yellowBright(
              "The route was loaded. Please don't forget to fix the issues.",
            )
      }`,
    );
  }
}

