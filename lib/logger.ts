/**
 * Structured logger utility using console.log
 * Provides consistent logging format across the application
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogContext {
  [key: string]: any;
}

class Logger {
  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private formatMessage(
    level: LogLevel,
    message: string,
    context?: LogContext
  ): string {
    const timestamp = this.formatTimestamp();
    const levelUpper = level.toUpperCase().padEnd(5);
    const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
    return `[${timestamp}] ${levelUpper} | ${message}${contextStr}`;
  }

  info(message: string, context?: LogContext): void {
    console.log(this.formatMessage('info', message, context));
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage('warn', message, context));
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorContext = error instanceof Error
      ? { ...context, error: error.message, stack: error.stack }
      : { ...context, error: String(error) };
    console.error(this.formatMessage('error', message, errorContext));
  }

  debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV === 'development') {
      console.log(this.formatMessage('debug', message, context));
    }
  }

  // API-specific logging helpers
  apiRequest(method: string, path: string, context?: LogContext): void {
    this.info(`API Request: ${method} ${path}`, context);
  }

  apiResponse(method: string, path: string, status: number, duration?: number): void {
    const context = duration ? { status, duration: `${duration}ms` } : { status };
    this.info(`API Response: ${method} ${path}`, context);
  }

  apiError(method: string, path: string, error: Error | unknown, context?: LogContext): void {
    this.error(`API Error: ${method} ${path}`, error, context);
  }

  // Database logging helpers
  dbQuery(query: string, params?: any[]): void {
    this.debug('DB Query', { query, params });
  }

  dbError(operation: string, error: Error | unknown): void {
    this.error(`DB Error: ${operation}`, error);
  }

  // External API logging helpers
  externalApiCall(service: string, endpoint: string, context?: LogContext): void {
    this.info(`External API Call: ${service} ${endpoint}`, context);
  }

  externalApiError(service: string, error: Error | unknown, context?: LogContext): void {
    this.error(`External API Error: ${service}`, error, context);
  }
}

// Export singleton instance
export const logger = new Logger();

// Export types for use in other modules
export type { LogContext, LogLevel };
