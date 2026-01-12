import { FileItem, BatchStats, ImageFormat } from '../../../types';

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
    calculateBatchStats(files: FileItem[], timing: BatchTiming = {}): BatchStats {
        if (!Array.isArray(files)) {
            console.warn('Invalid files array provided to calculateBatchStats');
            return this.getEmptyStats(timing);
        }

        const selectedFiles = files.filter(f => f?.selected);

        const breakdown: Record<ImageFormat, number> = {
            JPG: 0,
            PNG: 0,
            WebP: 0,
            BMP: 0
        };

        let totalSize = 0;
        let optimizedSize = 0;

        selectedFiles.forEach(f => {
            if (f.format in breakdown) {
                breakdown[f.format]++;
            } else {
                console.warn('Unknown image format:', f.format);
            }

            totalSize += Math.max(0, f.size || 0);

            if (f.status === 'Done' && f.optimizedSize) {
                optimizedSize += Math.max(0, f.optimizedSize);
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
        if (!Array.isArray(files) || files.length === 0) {
            return 0;
        }

        const selected = files.filter(f => f?.selected);
        if (selected.length === 0) return 0;

        const processed = selected.filter(f =>
            f.status === 'Done' || f.status === 'Error'
        ).length;

        const progress = (processed / selected.length) * 100;
        return Math.min(100, Math.max(0, progress));
    }

    /**
     * Calculate savings statistics
     */
    calculateSavings(files: FileItem[]) {
        if (!Array.isArray(files)) {
            return {
                totalSavedBytes: 0,
                savedPercent: 0,
                originalSizeProcessed: 0
            };
        }

        let totalSavedBytes = 0;
        let originalSizeProcessed = 0;

        files.forEach(f => {
            if (f?.status === 'Done') {
                const originalSize = f.size || 0;
                const optimized = f.optimizedSize || 0;

                if (optimized > 0 && optimized < originalSize) {
                    totalSavedBytes += (originalSize - optimized);
                    originalSizeProcessed += originalSize;
                } else if (optimized === 0) {
                    originalSizeProcessed += originalSize;
                }
            }
        });

        let savedPercent = 0;
        if (originalSizeProcessed > 0 && totalSavedBytes >= 0) {
            savedPercent = Math.min(
                100,
                Math.round((totalSavedBytes / originalSizeProcessed) * 100)
            );
        }

        return {
            totalSavedBytes: Math.max(0, totalSavedBytes),
            savedPercent,
            originalSizeProcessed
        };
    }

    /**
     * Format time duration in HH:mm:ss or mm:ss format
     */
    formatTime(ms: number): string {
        if (!Number.isFinite(ms) || ms < 0) {
            return '00:00';
        }

        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const mins = Math.floor((totalSeconds % 3600) / 60);
        const secs = totalSeconds % 60;

        if (hours > 0) {
            return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }

        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Format bytes to human readable format
     */
    formatBytes(bytes: number, decimals: number = 2): string {
        if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
        if (bytes === 0) return '0 B';

        const k = 1024;
        const dm = Math.max(0, decimals);
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];

        const i = Math.floor(Math.log(bytes) / Math.log(k));
        const size = bytes / Math.pow(k, i);

        return `${size.toFixed(dm)} ${sizes[i]}`;
    }

    /**
     * Calculate estimated time remaining
     */
    estimateTimeRemaining(
        filesProcessed: number,
        totalFiles: number,
        elapsedMs: number
    ): number {
        if (filesProcessed === 0 || totalFiles === 0 || elapsedMs <= 0) {
            return 0;
        }

        const avgTimePerFile = elapsedMs / filesProcessed;
        const remaining = totalFiles - filesProcessed;

        return Math.max(0, Math.round(avgTimePerFile * remaining));
    }

    /**
     * Get empty stats object
     */
    private getEmptyStats(timing: BatchTiming = {}): BatchStats {
        return {
            totalFiles: 0,
            totalSize: 0,
            optimizedSize: 0,
            formatBreakdown: {
                JPG: 0,
                PNG: 0,
                WebP: 0,
                BMP: 0
            },
            startTime: timing.startTime,
            endTime: timing.endTime
        };
    }
}

// Singleton instance
export const statsCalculationService = new StatsCalculationService();
