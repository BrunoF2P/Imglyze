/**
 * Base error class for application-specific errors
 */
export abstract class AppError extends Error {
    constructor(message: string) {
        super(message);
        this.name = this.constructor.name;
        Object.setPrototypeOf(this, new.target.prototype);
    }

    abstract get userMessage(): string;
}

/**
 * File discovery related errors
 */
export class FileDiscoveryError extends AppError {
    get userMessage(): string {
        return `File discovery failed: ${this.message}`;
    }
}

/**
 * Validation errors
 */
export class ValidationError extends AppError {
    constructor(message: string, public field?: string) {
        super(message);
    }

    get userMessage(): string {
        return this.field
            ? `Validation error in ${this.field}: ${this.message}`
            : `Validation error: ${this.message}`;
    }
}

/**
 * Processing errors
 */
export class ProcessingError extends AppError {
    get userMessage(): string {
        return `Processing failed: ${this.message}`;
    }
}

/**
 * Settings-related errors
 */
export class SettingsError extends AppError {
    get userMessage(): string {
        return `Settings error: ${this.message}`;
    }
}
