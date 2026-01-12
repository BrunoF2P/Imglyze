import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { logger } from '../../../lib/logger';
import { FileItem, BatchSettings } from '../../../types';
import { processingEventBus } from '../../../lib/EventBus';

export class BatchProcessingService {
    private initialized = false;
    private unlisteners: UnlistenFn[] = [];

    constructor() {
        this.initListeners().catch(err => {
            logger.error('Failed to initialize listeners:', err);
        });
    }

    private async initListeners() {
        if (this.initialized) return;
        this.initialized = true;

        const unlisten1 = await listen<FileItem>('file-processed', (event) => {
            processingEventBus.emit('file-processed', event.payload);
        });

        const unlisten2 = await listen<string>('log', (event) => {
            processingEventBus.emit('log', event.payload);
        });

        this.unlisteners.push(unlisten1, unlisten2);
    }

    async startBatch(files: FileItem[], settings: BatchSettings): Promise<void> {
        logger.info('Starting batch processing', {
            fileCount: files.length,
            outputMode: settings.outputMode
        });
        const endTimer = logger.time('batch-processing');

        await invoke('set_processing_status', { status: 0 });
        await invoke('run_batch', { items: files, settings });

        endTimer();
        logger.info('Batch processing completed');
    }

    async pauseBatch(): Promise<void> {
        await invoke('set_processing_status', { status: 1 });
    }

    async resumeBatch(): Promise<void> {
        await invoke('set_processing_status', { status: 0 });
    }

    async cancelBatch(): Promise<void> {
        await invoke('set_processing_status', { status: 2 });
    }

    subscribeToProgress(callback: (file: FileItem) => void): () => void {
        return processingEventBus.subscribe('file-processed', callback);
    }

    subscribeToLogs(callback: (log: string) => void): () => void {
        return processingEventBus.subscribe('log', callback);
    }

    public cleanup() {
        this.unlisteners.forEach(unlisten => unlisten());
        this.unlisteners = [];
        this.initialized = false;
    }
}

export const batchProcessingService = new BatchProcessingService();

if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        batchProcessingService.cleanup();
    });
}
