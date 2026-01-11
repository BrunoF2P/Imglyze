import { useState, useCallback } from 'react';
import { FileItem } from '../types';
import { statsCalculationService } from '../services';

interface ProcessingProgress {
    progress: number;
    currentFile: FileItem | null;
    completedCount: number;
    errorCount: number;
    totalSelected: number;
    isProcessing: boolean;
    isPaused: boolean;
    elapsedTime: number;
    estimatedTimeRemaining: number;
}

/**
 * Custom hook for tracking batch processing progress
 * Provides real-time progress metrics and status
 */
export const useProcessingProgress = (files: FileItem[]) => {
    const [startTime, setStartTime] = useState<number | null>(null);
    const [isPaused, setIsPaused] = useState(false);
    const [pausedTime, setPausedTime] = useState(0);

    const selectedFiles = files.filter(f => f.selected);

    const progress = statsCalculationService.calculateProgress(files);

    const completedFiles = selectedFiles.filter(f =>
        f.status === 'Done' || f.status === 'Error'
    );

    const completedCount = selectedFiles.filter(f => f.status === 'Done').length;
    const errorCount = selectedFiles.filter(f => f.status === 'Error').length;

    const currentFile = selectedFiles.find(f => f.status === 'Processing') || null;
    const isProcessing = currentFile !== null;

    // Calculate elapsed time
    const elapsedTime = startTime && !isPaused
        ? Date.now() - startTime - pausedTime
        : 0;

    // Estimate time remaining
    const estimatedTimeRemaining = completedFiles.length > 0 && elapsedTime > 0
        ? (elapsedTime / completedFiles.length) * (selectedFiles.length - completedFiles.length)
        : 0;

    // Start tracking
    const start = useCallback(() => {
        setStartTime(Date.now());
        setIsPaused(false);
        setPausedTime(0);
    }, []);

    // Pause tracking
    const pause = useCallback(() => {
        setIsPaused(true);
    }, []);

    // Resume tracking
    const resume = useCallback(() => {
        if (startTime && isPaused) {
            const pauseDuration = Date.now() - (startTime + elapsedTime);
            setPausedTime(prev => prev + pauseDuration);
            setIsPaused(false);
        }
    }, [startTime, isPaused, elapsedTime]);

    // Reset tracking
    const reset = useCallback(() => {
        setStartTime(null);
        setIsPaused(false);
        setPausedTime(0);
    }, []);

    const progressData: ProcessingProgress = {
        progress,
        currentFile,
        completedCount,
        errorCount,
        totalSelected: selectedFiles.length,
        isProcessing,
        isPaused,
        elapsedTime,
        estimatedTimeRemaining
    };

    return {
        ...progressData,
        start,
        pause,
        resume,
        reset,
        formattedElapsedTime: statsCalculationService.formatTime(elapsedTime),
        formattedEstimatedTime: statsCalculationService.formatTime(estimatedTimeRemaining)
    };
};
