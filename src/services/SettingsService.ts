import { BatchSettings, ImageFormat, AdvancedSettings } from '../types';
import { invoke } from '@tauri-apps/api/core';
import { logger } from '../lib/logger';

/**
 * Preset configurations for batch processing
 */
export const PRESETS: Record<string, Record<ImageFormat, AdvancedSettings>> = {
    'Balanced (80)': {
        JPG: { targetFormat: 'Original', quality: 80, keepMetadata: false },
        PNG: { targetFormat: 'Original', quality: 90, keepMetadata: false },
        WebP: { targetFormat: 'Original', quality: 80, keepMetadata: false },
        BMP: { targetFormat: 'Original', quality: 80, keepMetadata: false }
    },
    'High Quality (95)': {
        JPG: { targetFormat: 'Original', quality: 95, keepMetadata: false },
        PNG: { targetFormat: 'Original', quality: 98, keepMetadata: false },
        WebP: { targetFormat: 'Original', quality: 95, keepMetadata: false },
        BMP: { targetFormat: 'Original', quality: 95, keepMetadata: false }
    },
    'Lossless': {
        JPG: { targetFormat: 'Original', quality: 100, keepMetadata: false },
        PNG: { targetFormat: 'Original', quality: 100, keepMetadata: false },
        WebP: { targetFormat: 'Original', quality: 100, keepMetadata: false },
        BMP: { targetFormat: 'Original', quality: 100, keepMetadata: false }
    }
};

/**
 * Service for managing settings and presets
 */
export class SettingsService {
    /**
     * Get default batch settings
     */
    getDefaultSettings(translatedPreset: string): BatchSettings {
        return {
            globalPreset: translatedPreset,
            advancedMode: false,
            formatPresets: PRESETS['Balanced (80)'],
            outputMode: 'Folder',
            outputZipName: 'images_optimized.zip'
        };
    }

    /**
     * Apply a preset by name
     */
    applyPreset(presetName: string): Record<ImageFormat, AdvancedSettings> | null {
        const presetKey = Object.keys(PRESETS).find(key => {
            const simpleName = key.split(' ')[0]; // "Balanced", "High", "Lossless"
            return presetName.includes(simpleName.toLowerCase()) ||
                presetName === key;
        });

        return presetKey ? PRESETS[presetKey] : null;
    }

    /**
     * Detect which preset matches the given settings
     */
    detectPreset(formatPresets: Record<ImageFormat, AdvancedSettings>): string {
        for (const [key, value] of Object.entries(PRESETS)) {
            if (JSON.stringify(value) === JSON.stringify(formatPresets)) {
                return key;
            }
        }
        return 'Custom';
    }

    async saveSettings(settings: BatchSettings): Promise<void> {
        logger.debug('Saving settings', { outputMode: settings.outputMode });
        await invoke('save_settings', { settings });
        logger.info('Settings saved successfully');
    }

    /**
     * Update a specific format's advanced settings
     */
    updateFormatSettings(
        currentSettings: BatchSettings,
        format: ImageFormat,
        updates: Partial<AdvancedSettings>
    ): BatchSettings {
        const newPresets = {
            ...currentSettings.formatPresets,
            [format]: { ...currentSettings.formatPresets[format], ...updates }
        };

        return {
            ...currentSettings,
            formatPresets: newPresets,
            globalPreset: this.detectPreset(newPresets)
        };
    }
}

// Singleton instance
export const settingsService = new SettingsService();
