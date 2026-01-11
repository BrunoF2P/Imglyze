import { FileItem, BatchStats, ImageFormat } from '../types';

interface BatchTiming {
    startTime?: number;
    endTime?: number;
}

/**
 * Service for calculating batch statistics
 */
export class StatsCalculationService {
    /**
     * Calculate comprehensive batch statistics
     */
    calculateBatchStats(files: FileItem[], timing: BatchTiming): BatchStats {
        const selectedFiles = files.filter(f => f.selected);
        const breakdown: Record<ImageFormat, number> = {
            JPG: 0,
            PNG: 0,
            WebP: 0,
            BMP: 0
        };

        let totalSize = 0;
        let optimizedSize = 0;

        selectedFiles.forEach(f => {
            breakdown[f.format]++;
            totalSize += f.size;
            if (f.status === 'Done') {
                optimizedSize += (f.optimizedSize || 0);
            }
        });

        return {
            totalFiles: files.length,
            totalSize,
            optimizedSize,
            formatBreakdown: breakdown,
            startTime: timing.startTime,
            endTime: timing.endTime
        };
    }

    /**
     * Calculate processing progress percentage
     */
    calculateProgress(files: FileItem[]): number {
        const selected = files.filter(f => f.selected);
        if (selected.length === 0) return 0;

        const processed = selected.filter(f =>
            f.status === 'Done' || f.status === 'Error'
        ).length;

        return (processed / selected.length) * 100;
    }

    /**
     * Calculate savings statistics
     */
    calculateSavings(files: FileItem[]) {
        const totalSavedBytes = files.reduce((acc, f) => {
            if (f.status === 'Done' && f.optimizedSize) {
                return acc + (f.size - f.optimizedSize);
            }
            return acc;
        }, 0);

        const originalSizeProcessed = files.reduce((acc, f) => {
            if (f.status === 'Done') return acc + f.size;
            return acc;
        }, 0);

        const savedPercent = originalSizeProcessed > 0
            ? Math.round((totalSavedBytes / originalSizeProcessed) * 100)
            : 0;

        return {
            totalSavedBytes,
            savedPercent,
            originalSizeProcessed
        };
    }

    /**
     * Format time duration in mm:ss format
     */
    formatTime(ms: number): string {
        const seconds = Math.floor(ms / 1000);
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
}

// Singleton instance
export const statsCalculationService = new StatsCalculationService();
