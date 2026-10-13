import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { logger } from '../../../lib/logger';
import { FileItem, BatchSettings, BatchOutcome } from '../../../types';
import { processingEventBus } from '../../../lib/EventBus';

export class BatchProcessingService {
    private cancelled = false;
    private ready?: Promise<void>;
    private unlisteners: UnlistenFn[] = [];

    private initListeners(): Promise<void> {
        this.ready ??= (async () => {
            const progress = await listen<FileItem>('file-processed', event => processingEventBus.emit('file-processed', event.payload));
            try {
                const logs = await listen<string>('log', event => processingEventBus.emit('log', event.payload));
                this.unlisteners.push(progress, logs);
            } catch (error) { progress(); this.ready = undefined; throw error; }
        })().catch(error => { this.ready = undefined; throw error; });
        return this.ready;
    }

    async startBatch(files: FileItem[], settings: BatchSettings): Promise<BatchOutcome> {
        logger.info('Starting batch processing', {
            fileCount: files.length,
            outputMode: settings.outputMode
        });
        const endTimer = logger.time('batch-processing');

        this.cancelled = false;
        await this.initListeners();
        if (this.cancelled) return { cancelled: true, successes: 0, errors: 0 };
        const outcome = await invoke<BatchOutcome>('run_batch', { items: files, settings });

        endTimer();
        logger.info('Batch processing completed');
        return outcome;
    }

    async pauseBatch(): Promise<void> {
        await invoke('set_processing_status', { status: 1 });
    }

    async resumeBatch(): Promise<void> {
        await invoke('set_processing_status', { status: 0 });
    }

    async cancelBatch(): Promise<void> {
        this.cancelled = true;
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
        this.ready = undefined;
    }
}

export const batchProcessingService = new BatchProcessingService();

if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        batchProcessingService.cleanup();
    });
}
