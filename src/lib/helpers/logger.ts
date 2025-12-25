import chalk from 'chalk';
import { Route } from '../structures/route';
import { Schema } from '../structures/schema';
import { Middleware } from '../structures/middleware';

export interface StartupStats {
  warnings: number;
  deprecationWarnings: number;
  errors: number;
  routesLoaded: number;
  schemasLoaded: number;
  middlewaresLoaded: number;
}

export class Logger {
  private static statsTracker: StartupStats | null = null;

  static setStatsTracker(stats: StartupStats) {
    Logger.statsTracker = stats;
  }

  static clearStatsTracker() {
    Logger.statsTracker = null;
  }

  static routeLoaded(route: Route) {
    if (Logger.statsTracker) {
      Logger.statsTracker.routesLoaded++;
    }
    console.info(
      chalk.gray(
        '[',
        chalk.green('+'),
        ']',
        'Loaded Route',
        chalk.cyan(route.path),
      ),
    );
  }

  static schemaLoaded(schema: Schema) {
    if (Logger.statsTracker) {
      Logger.statsTracker.schemasLoaded++;
    }
    console.info(
      chalk.gray(
        '[',
        chalk.green('+'),
        ']',
        'Loaded Schema',
        chalk.cyan(schema.path),
      ),
    );
  }

  static middlewareLoaded(middleware: Middleware) {
    if (Logger.statsTracker) {
      Logger.statsTracker.middlewaresLoaded++;
    }
    console.info(
      chalk.gray(
        '[',
        chalk.green('+'),
        ']',
        'Loaded Middleware',
        chalk.cyan(middleware.filePath),
      ),
    );
  }

  static serverStarted({
    port,
    seconds,
    stats,
  }: {
    port: number;
    seconds: number;
    stats?: StartupStats;
  }) {
    const prefix = chalk.gray('[', chalk.green('✓'), ']');

    // Main startup message section
    console.info(
      chalk.gray(
        `
${prefix}
${prefix} ${chalk.bold.green('API Server started 🚀')}
${prefix} Port: ${chalk.blue(port)}
${prefix} Booted in ${chalk.blue(seconds)}s
${prefix}
    `.trim(),
      ),
    );

    // Statistics section (separate)
    if (stats) {
      const statsLines: string[] = [];
      const statsPrefix = chalk.gray('[', chalk.cyan('📊'), ']');

      // Always show loaded counts
      statsLines.push(
        `${statsPrefix} ${chalk.cyan('Routes Loaded:')} ${chalk.cyan.bold(stats.routesLoaded)}`,
      );
      statsLines.push(
        `${statsPrefix} ${chalk.cyan('Schemas Loaded:')} ${chalk.cyan.bold(stats.schemasLoaded)}`,
      );
      statsLines.push(
        `${statsPrefix} ${chalk.cyan('Middlewares Loaded:')} ${chalk.cyan.bold(stats.middlewaresLoaded)}`,
      );

      // Only show errors/warnings if they occurred
      if (stats.errors > 0) {
        statsLines.push(
          `${statsPrefix} ${chalk.red('Errors:')} ${chalk.red.bold(stats.errors)}`,
        );
      }
      if (stats.warnings > 0) {
        statsLines.push(
          `${statsPrefix} ${chalk.yellow('Warnings:')} ${chalk.yellow.bold(stats.warnings)}`,
        );
      }
      if (stats.deprecationWarnings > 0) {
        statsLines.push(
          `${statsPrefix} ${chalk.yellow('Deprecation Warnings:')} ${chalk.yellow.bold(stats.deprecationWarnings)}`,
        );
      }

      if (statsLines.length > 0) {
        console.info(
          chalk.gray(
            `
${statsPrefix} ${chalk.bold.cyan('Startup Statistics')}
${statsLines.join('\n')}
${statsPrefix}
        `.trim(),
          ),
        );
      }
    }
  }

  static starting() {
    console.info(chalk.gray('[', chalk.green('⌛'), ']', 'API is starting...'));
  }

  static deprecationWarning(message: string, location?: string) {
    if (Logger.statsTracker) {
      Logger.statsTracker.deprecationWarnings++;
    }
    console.warn(
      chalk.gray('[', chalk.yellow('⚠'), ']'),
      chalk.yellow('Deprecation Warning:'),
      message,
      location ? chalk.gray(`(${location})`) : '',
    );
  }

  static warning(message: string, location?: string) {
    if (Logger.statsTracker) {
      Logger.statsTracker.warnings++;
    }
    console.warn(
      chalk.gray('[', chalk.yellow('⚠'), ']'),
      chalk.yellow('Warning:'),
      message,
      location ? chalk.gray(`(${location})`) : '',
    );
  }

  static error(message: string, error?: unknown) {
    if (Logger.statsTracker) {
      Logger.statsTracker.errors++;
    }
    console.error(message, error || '');
  }
}
