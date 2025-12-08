import type { Config } from '../typings';

/**
 * Debug logging utility that can be used across the entire API
 */
export function debugLog(config: Config | undefined, ...args: any[]): void {
  if (config?.debug === true) {
    console.log('[DEBUG]', ...args);
  }
}

/**
 * Debug logger class that encapsulates debug logging functionality
 */
export class DebugLogger {
  private config: any;

  constructor(config: any) {
    this.config = config;
  }

  /**
   * Update the config (useful when config is loaded asynchronously)
   */
  updateConfig(config: any): void {
    this.config = config;
  }

  /**
   * Log a debug message if debug mode is enabled
   */
  debug(...args: any[]): void {
    if (this.config?.debug === true) {
      console.log('[DEBUG]', ...args);
    }
  }
}

