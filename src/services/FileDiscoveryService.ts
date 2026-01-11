import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { logger } from '../lib/logger';
import { FileItem, DiscoveryResult } from '../types';

/**
 * Service for discovering image files from various sources
 */
export class FileDiscoveryService {
    /**
     * Discover files from file system paths
     */
    async discoverFiles(paths: string[]): Promise<DiscoveryResult> {
        logger.info('Discovering files', { pathCount: paths.length });
        const result = await invoke<DiscoveryResult>('discover_files', { paths });
        logger.debug('Files discovered', { fileCount: result.items?.length || 0 });
        return result;
    }

    /**
     * Open dialog to select image files
     */
    async selectImages(translatedLabel: string): Promise<FileItem[]> {
        const selected = await open({
            multiple: true,
            directory: false,
            title: translatedLabel,
            filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp'] }]
        });

        if (selected && Array.isArray(selected)) {
            return this.discoverFilesFromSelection(selected);
        }
        return [];
    }

    /**
     * Open dialog to select ZIP files
     */
    async selectZip(translatedLabel: string): Promise<FileItem[]> {
        const selected = await open({
            multiple: true,
            directory: false,
            title: translatedLabel,
            filters: [{ name: 'Archive', extensions: ['zip'] }]
        });

        if (selected && Array.isArray(selected)) {
            return this.discoverFilesFromSelection(selected);
        }
        return [];
    }

    /**
     * Open dialog to select a folder
     */
    async selectFolder(translatedLabel: string): Promise<FileItem[]> {
        const selected = await open({
            directory: true,
            multiple: false,
            title: translatedLabel
        });

        if (selected && typeof selected === 'string') {
            return this.discoverFilesFromSelection([selected]);
        }
        return [];
    }

    /**
     * Convert file selection to FileItems
     */
    private async discoverFilesFromSelection(paths: string[]): Promise<FileItem[]> {
        const result = await this.discoverFiles(paths);
        return result.items;
    }
}

// Singleton instance
export const fileDiscoveryService = new FileDiscoveryService();
