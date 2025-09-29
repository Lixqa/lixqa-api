import chalk from 'chalk';
import { Route } from '../structures/route';
import { Schema } from '../structures/schema';

export class Logger {
  static routeLoaded(route: Route) {
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

  static serverStarted({ port, seconds }: { port: number; seconds: number }) {
    const prefix = chalk.gray('[', chalk.green('✓'), ']');

    console.info(
      chalk.gray(
        `
${prefix}
${prefix} ${chalk.bold.green('API Server started 🚀')}
${prefix} Port: ${chalk.blue(port)}
${prefix} Booted in ${seconds}s
${prefix}
    `.trim(),
      ),
    );
  }

  static starting() {
    console.info(chalk.gray('[', chalk.green('⌛'), ']', 'API is starting...'));
  }
}
