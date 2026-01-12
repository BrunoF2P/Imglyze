import { useMemo } from 'react';
import { FileItem, BatchStats } from '../../../types';

export function useResultStats(files: FileItem[], stats: BatchStats) {
    return useMemo(() => {
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

        const totalTimeMs = stats.endTime && stats.startTime
            ? stats.endTime - stats.startTime
            : 0;

        const formatTime = (ms: number) => {
            const seconds = Math.floor(ms / 1000);
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        };

        return {
            totalSavedBytes,
            savedPercent,
            totalTimeMs,
            formatTime
        };
    }, [files, stats]);
}
