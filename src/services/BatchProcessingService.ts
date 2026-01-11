import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { logger } from '../lib/logger';
import { FileItem, BatchSettings } from '../types';

/**
 * Service for batch processing operations
 */
export class BatchProcessingService {
    /**
     * Start batch processing
     */
    async startBatch(files: FileItem[], settings: BatchSettings): Promise<void> {
        logger.info('Starting batch processing', { fileCount: files.length, outputMode: settings.outputMode });
        const endTimer = logger.time('batch-processing');
        await invoke('set_processing_status', { status: 0 });
        await invoke('run_batch', { items: files, settings });
        endTimer();
        logger.info('Batch processing completed');
    }

    /**
     * Pause batch processing
     */
    async pauseBatch(): Promise<void> {
        await invoke('set_processing_status', { status: 1 });
    }

    /**
     * Resume batch processing
     */
    async resumeBatch(): Promise<void> {
        await invoke('set_processing_status', { status: 0 });
    }

    /**
     * Cancel batch processing
     */
    async cancelBatch(): Promise<void> {
        await invoke('set_processing_status', { status: 2 });
    }

    /**
     * Subscribe to file processing updates
     */
    subscribeToProgress(callback: (file: FileItem) => void): Promise<UnlistenFn> {
        return listen<FileItem>('file-processed', (event) => {
            callback(event.payload);
        });
    }

    /**
     * Subscribe to processing logs
     */
    subscribeToLogs(callback: (log: string) => void): Promise<UnlistenFn> {
        return listen<string>('log', (event) => {
            callback(event.payload);
        });
    }
}

// Singleton instance
export const batchProcessingService = new BatchProcessingService();
