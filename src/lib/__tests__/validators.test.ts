import { describe, it, expect } from 'vitest';
import { validateBatchSettings, validateFileSelection } from '../validators';
import type { BatchSettings, FileItem } from '../../types';

describe('validators', () => {
    describe('validateBatchSettings', () => {
        it('should validate valid settings', () => {
            const settings: BatchSettings = {
                globalPreset: 'balanced',
                advancedMode: false,
                formatPresets: {
                    JPG: { targetFormat: 'Original', quality: 85, keepMetadata: false },
                    PNG: { targetFormat: 'Original', quality: 90, keepMetadata: false },
                },
                outputMode: 'Folder',
                outputPath: '/tmp/output',
            };

            const result = validateBatchSettings(settings);
            expect(result.isValid).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it('should require ZIP name for ZIP output mode', () => {
            const settings: BatchSettings = {
                globalPreset: 'balanced',
                advancedMode: false,
                formatPresets: {
                    JPG: { targetFormat: 'Original', quality: 85, keepMetadata: false },
                },
                outputMode: 'ZIP',
                outputZipName: '',
            };

            const result = validateBatchSettings(settings);
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('Zip filename is required');
        });

        it('should validate quality range', () => {
            const settings: BatchSettings = {
                globalPreset: 'balanced',
                advancedMode: true,
                formatPresets: {
                    JPG: { targetFormat: 'Original', quality: 150, keepMetadata: false },
                },
                outputMode: 'Replace',
            };

            const result = validateBatchSettings(settings);
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('Invalid quality');
        });

        it('should reject negative quality', () => {
            const settings: BatchSettings = {
                globalPreset: 'balanced',
                advancedMode: true,
                formatPresets: {
                    PNG: { targetFormat: 'Original', quality: -10, keepMetadata: false },
                },
                outputMode: 'Replace',
            };

            const result = validateBatchSettings(settings);
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('Invalid quality');
        });

        it('should validate maxFileSize if provided', () => {
            const settings: BatchSettings = {
                globalPreset: 'balanced',
                advancedMode: true,
                formatPresets: {
                    JPG: {
                        targetFormat: 'Original',
                        quality: 85,
                        maxFileSize: -100,
                        keepMetadata: false,
                    },
                },
                outputMode: 'Replace',
            };

            const result = validateBatchSettings(settings);
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('Invalid max file size');
        });

        it('should accept valid maxFileSize', () => {
            const settings: BatchSettings = {
                globalPreset: 'balanced',
                advancedMode: true,
                formatPresets: {
                    JPG: {
                        targetFormat: 'Original',
                        quality: 85,
                        maxFileSize: 500,
                        keepMetadata: false,
                    },
                },
                outputMode: 'Replace',
            };

            const result = validateBatchSettings(settings);
            expect(result.isValid).toBe(true);
        });
    });

    describe('validateFileSelection', () => {
        it('should reject empty file list', () => {
            const result = validateFileSelection([]);
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('No files selected');
        });

        it('should reject when no files are selected', () => {
            const files: FileItem[] = [
                {
                    id: '1',
                    name: 'image.jpg',
                    path: '/path/to/image.jpg',
                    size: 1000,
                    format: 'JPG',
                    status: 'Pending',
                    selected: false,
                },
                {
                    id: '2',
                    name: 'photo.png',
                    path: '/path/to/photo.png',
                    size: 2000,
                    format: 'PNG',
                    status: 'Pending',
                    selected: false,
                },
            ];

            const result = validateFileSelection(files);
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('No files selected for processing');
        });

        it('should accept when at least one file is selected', () => {
            const files: FileItem[] = [
                {
                    id: '1',
                    name: 'image.jpg',
                    path: '/path/to/image.jpg',
                    size: 1000,
                    format: 'JPG',
                    status: 'Pending',
                    selected: true,
                },
                {
                    id: '2',
                    name: 'photo.png',
                    path: '/path/to/photo.png',
                    size: 2000,
                    format: 'PNG',
                    status: 'Pending',
                    selected: false,
                },
            ];

            const result = validateFileSelection(files);
            expect(result.isValid).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it('should accept when all files are selected', () => {
            const files: FileItem[] = [
                {
                    id: '1',
                    name: 'image.jpg',
                    path: '/path/to/image.jpg',
                    size: 1000,
                    format: 'JPG',
                    status: 'Pending',
                    selected: true,
                },
            ];

            const result = validateFileSelection(files);
            expect(result.isValid).toBe(true);
        });
    });
});
