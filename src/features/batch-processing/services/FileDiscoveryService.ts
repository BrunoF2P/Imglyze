import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { logger } from '../../../lib/logger';
import { FileItem, DiscoveryResult } from '../../../types';

/**
 * Service for discovering image files from various sources
 */
export class FileDiscoveryService {
    /**
     * Discover files from file system paths
     */
    async discoverFiles(paths: string[]): Promise<DiscoveryResult> {
        logger.info('Discovering files', { pathCount: paths.length });

        try {
            const result = await invoke<DiscoveryResult>('discover_files', { paths });
            if (!result || !result.items) {
                logger.warn('Invalid discovery result', { result });
                return { items: [], errors: ['Invalid result from backend'] };
            }

            if (result.errors && result.errors.length > 0) {
                logger.warn('Discovery completed with errors', {
                    errorCount: result.errors.length,
                    errors: result.errors
                });
            }

            logger.debug('Files discovered', {
                fileCount: result.items.length,
                errorCount: result.errors?.length || 0
            });

            return result;
        } catch (error) {
            logger.error('Failed to discover files', { error, paths });
            throw new Error(`File discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Open dialog to select image files
     */
    async selectImages(translatedLabel: string): Promise<FileItem[]> {
        try {
            const selected = await open({
                multiple: true,
                directory: false,
                title: translatedLabel,
                filters: [{
                    name: 'Images',
                    extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'avif', 'svg']
                }]
            });

            if (!selected) {
                logger.debug('Image selection cancelled by user');
                return [];
            }

            if (!Array.isArray(selected)) {
                logger.warn('Unexpected selection type', { selected });
                return [];
            }

            logger.info('Images selected', { count: selected.length });
            return this.discoverFilesFromSelection(selected);
        } catch (error) {
            logger.error('Failed to select images', { error });
            throw new Error(`Image selection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Open dialog to select ZIP files
     */
    async selectZip(translatedLabel: string): Promise<FileItem[]> {
        try {
            const selected = await open({
                multiple: true,
                directory: false,
                title: translatedLabel,
                filters: [{ name: 'Archive', extensions: ['zip'] }]
            });

            if (!selected) {
                logger.debug('ZIP selection cancelled by user');
                return [];
            }

            if (!Array.isArray(selected)) {
                logger.warn('Unexpected ZIP selection type', { selected });
                return [];
            }

            logger.info('ZIP files selected', { count: selected.length });
            return this.discoverFilesFromSelection(selected);
        } catch (error) {
            logger.error('Failed to select ZIP files', { error });
            throw new Error(`ZIP selection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Open dialog to select a folder
     */
    async selectFolder(translatedLabel: string): Promise<FileItem[]> {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
                title: translatedLabel
            });

            if (!selected) {
                logger.debug('Folder selection cancelled by user');
                return [];
            }

            if (typeof selected !== 'string') {
                logger.warn('Unexpected folder selection type', { selected });
                return [];
            }

            logger.info('Folder selected', { path: selected });
            return this.discoverFilesFromSelection([selected]);
        } catch (error) {
            logger.error('Failed to select folder', { error });
            throw new Error(`Folder selection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Convert file selection to FileItems
     */
    private async discoverFilesFromSelection(paths: string[]): Promise<FileItem[]> {
        try {
            const result = await this.discoverFiles(paths);

            return result.items || [];
        } catch (error) {
            logger.error('Failed to discover files from selection', { error, paths });
            throw error;
        }
    }

    /**
     * Get discovery errors for display to user
     */
    getErrorSummary(result: DiscoveryResult): string | null {
        if (!result.errors || result.errors.length === 0) {
            return null;
        }

        const errorCount = result.errors.length;
        const firstError = result.errors[0];

        if (errorCount === 1) {
            return firstError;
        }

        return `${errorCount} errors occurred. First error: ${firstError}`;
    }
}

// Singleton instance
export const fileDiscoveryService = new FileDiscoveryService();
