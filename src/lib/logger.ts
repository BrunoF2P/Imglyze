/**
 * Structured Logger for Imglyze
 * Provides consistent, structured logging throughout the application
 */

export enum LogLevel {
    DEBUG = 'DEBUG',
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR',
}

interface LogContext {
    [key: string]: any;
}

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    context?: LogContext;
    error?: Error;
}

class Logger {
    private isDevelopment: boolean;
    private minLevel: LogLevel;

    constructor() {
        this.isDevelopment = import.meta.env.DEV;
        this.minLevel = this.isDevelopment ? LogLevel.DEBUG : LogLevel.INFO;
    }

    private shouldLog(level: LogLevel): boolean {
        const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
        const currentIndex = levels.indexOf(level);
        const minIndex = levels.indexOf(this.minLevel);
        return currentIndex >= minIndex;
    }

    private formatEntry(entry: LogEntry): string {
        const parts = [
            `[${entry.timestamp}]`,
            `[${entry.level}]`,
            entry.message,
        ];

        if (entry.context && Object.keys(entry.context).length > 0) {
            parts.push(JSON.stringify(entry.context));
        }

        if (entry.error) {
            parts.push(`\nError: ${entry.error.message}`);
            if (entry.error.stack && this.isDevelopment) {
                parts.push(`\nStack: ${entry.error.stack}`);
            }
        }

        return parts.join(' ');
    }

    private log(level: LogLevel, message: string, context?: LogContext, error?: Error) {
        if (!this.shouldLog(level)) return;

        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            context,
            error,
        };

        const formatted = this.formatEntry(entry);

        // Console output with appropriate method
        switch (level) {
            case LogLevel.DEBUG:
                console.debug(formatted);
                break;
            case LogLevel.INFO:
                console.info(formatted);
                break;
            case LogLevel.WARN:
                console.warn(formatted);
                break;
            case LogLevel.ERROR:
                console.error(formatted);
                break;
        }

        // In production, you could send to a logging service
        if (!this.isDevelopment && level === LogLevel.ERROR) {
            this.sendToErrorTracking(entry);
        }
    }

    private sendToErrorTracking(entry: LogEntry) {
        // Hook for error tracking service (Sentry, etc.)
        // TODO: Implement error tracking integration
        console.warn('Error tracking not yet configured:', entry);
    }

    debug(message: string, context?: LogContext) {
        this.log(LogLevel.DEBUG, message, context);
    }

    info(message: string, context?: LogContext) {
        this.log(LogLevel.INFO, message, context);
    }

    warn(message: string, context?: LogContext) {
        this.log(LogLevel.WARN, message, context);
    }

    error(message: string, contextOrError?: LogContext | Error, error?: Error) {
        if (contextOrError instanceof Error) {
            this.log(LogLevel.ERROR, message, undefined, contextOrError);
        } else {
            this.log(LogLevel.ERROR, message, contextOrError, error);
        }
    }

    // Utility method for performance tracking
    time(label: string): () => void {
        const start = performance.now();
        this.debug(`Timer started: ${label}`);

        return () => {
            const duration = performance.now() - start;
            this.debug(`Timer ended: ${label}`, { duration: `${duration.toFixed(2)}ms` });
        };
    }
}

// Export singleton instance
export const logger = new Logger();

// Export type for use in other files
export type { LogContext };
