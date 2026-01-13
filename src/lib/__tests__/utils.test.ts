import { describe, it, expect } from 'vitest';
import { formatBytes, cn } from '../utils';

describe('utils', () => {
    describe('formatBytes', () => {
        it('should format 0 bytes correctly', () => {
            expect(formatBytes(0)).toBe('0 B');
        });

        it('should format bytes correctly', () => {
            expect(formatBytes(100)).toBe('100.00 B');
            expect(formatBytes(1024)).toBe('1.00 KB');
            expect(formatBytes(1536)).toBe('1.50 KB');
        });

        it('should format kilobytes correctly', () => {
            expect(formatBytes(2048)).toBe('2.00 KB');
            expect(formatBytes(102400)).toBe('100.00 KB');
        });

        it('should format megabytes correctly', () => {
            expect(formatBytes(1048576)).toBe('1.00 MB');
            expect(formatBytes(5242880)).toBe('5.00 MB');
        });

        it('should format gigabytes correctly', () => {
            expect(formatBytes(1073741824)).toBe('1.00 GB');
            expect(formatBytes(2147483648)).toBe('2.00 GB');
        });

        it('should handle custom decimal places', () => {
            expect(formatBytes(1536, 0)).toBe('2 KB');
            expect(formatBytes(1536, 1)).toBe('1.5 KB');
            expect(formatBytes(1536, 3)).toBe('1.500 KB');
        });

        it('should handle negative numbers', () => {
            expect(formatBytes(-100)).toBe('0 B');
        });

        it('should handle non-finite numbers', () => {
            expect(formatBytes(Infinity)).toBe('0 B');
            expect(formatBytes(NaN)).toBe('0 B');
        });

        it('should handle very large numbers', () => {
            const huge = 1024 ** 10; // Exabytes territory
            const result = formatBytes(huge);
            expect(result).toContain('TB'); // Should cap at TB
        });
    });

    describe('cn', () => {
        it('should merge class names', () => {
            expect(cn('foo', 'bar')).toBe('foo bar');
        });

        it('should handle conditional classes', () => {
            expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
        });

        it('should merge tailwind classes correctly', () => {
            // twMerge should handle conflicting tailwind classes
            expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
        });

        it('should handle empty inputs', () => {
            expect(cn()).toBe('');
        });

        it('should handle undefined and null', () => {
            expect(cn('foo', undefined, 'bar', null)).toBe('foo bar');
        });
    });
});
