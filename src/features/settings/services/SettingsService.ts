import { BatchSettings, ImageFormat, AdvancedSettings } from '../../../types';
import { LazyStore } from '@tauri-apps/plugin-store';
import { validateSettings as validateSchema } from '../../../schemas/settingsSchema';
import { logger } from '../../../lib/logger';

const STORE_FILENAME = 'settings.json';
const SETTINGS_KEY = 'batch_settings';

/**
 * Preset IDs (não traduzíveis)
 */
export enum PresetId {
    BALANCED = 'balanced',
    HIGH_QUALITY = 'high_quality',
    LOSSLESS = 'lossless',
    CUSTOM = 'custom'
}

/**
 * Preset configurations
 */
export const PRESETS: Record<PresetId, Record<ImageFormat, AdvancedSettings>> = {
    [PresetId.BALANCED]: {
        JPG: { targetFormat: 'Original', quality: 80, keepMetadata: false },
        PNG: { targetFormat: 'Original', quality: 90, keepMetadata: false },
        WebP: { targetFormat: 'Original', quality: 80, keepMetadata: false },
        BMP: { targetFormat: 'Original', quality: 80, keepMetadata: false },
        AVIF: { targetFormat: 'Original', quality: 80, keepMetadata: false },
        SVG: { targetFormat: 'PNG', quality: 100, keepMetadata: false }
    },
    [PresetId.HIGH_QUALITY]: {
        JPG: { targetFormat: 'Original', quality: 95, keepMetadata: false },
        PNG: { targetFormat: 'Original', quality: 98, keepMetadata: false },
        WebP: { targetFormat: 'Original', quality: 95, keepMetadata: false },
        BMP: { targetFormat: 'Original', quality: 95, keepMetadata: false },
        AVIF: { targetFormat: 'Original', quality: 95, keepMetadata: false },
        SVG: { targetFormat: 'PNG', quality: 100, keepMetadata: false }
    },
    [PresetId.LOSSLESS]: {
        JPG: { targetFormat: 'Original', quality: 100, keepMetadata: false },
        PNG: { targetFormat: 'Original', quality: 100, keepMetadata: false },
        WebP: { targetFormat: 'Original', quality: 100, keepMetadata: false },
        BMP: { targetFormat: 'Original', quality: 100, keepMetadata: false },
        AVIF: { targetFormat: 'Original', quality: 100, keepMetadata: false },
        SVG: { targetFormat: 'PNG', quality: 100, keepMetadata: false }
    },
    [PresetId.CUSTOM]: {
        JPG: { targetFormat: 'Original', quality: 80, keepMetadata: false },
        PNG: { targetFormat: 'Original', quality: 90, keepMetadata: false },
        WebP: { targetFormat: 'Original', quality: 80, keepMetadata: false },
        BMP: { targetFormat: 'Original', quality: 80, keepMetadata: false },
        AVIF: { targetFormat: 'Original', quality: 80, keepMetadata: false },
        SVG: { targetFormat: 'PNG', quality: 100, keepMetadata: false }
    }
};

/**
 * Valid image formats
 */
const VALID_FORMATS: ImageFormat[] = ['JPG', 'PNG', 'WebP', 'BMP', 'AVIF', 'SVG'];

export class SettingsService {
    private store: LazyStore;

    constructor() {
        this.store = new LazyStore(STORE_FILENAME);
    }

    /**
     * Get default batch settings
     */
    getDefaultSettings(): BatchSettings {
        return {
            resize: { mode: 'Original', width: 1920, height: 1920, percent: 100, filter: 'Lanczos3' },
            measureQuality: false,
            globalPreset: PresetId.BALANCED,
            advancedMode: false,
            formatPresets: structuredClone(PRESETS[PresetId.BALANCED]),
            outputMode: 'Folder',
            outputZipName: 'images_optimized.zip'
        };
    }

    /**
     * Apply a preset by ID
     */
    applyPreset(presetId: PresetId): Record<ImageFormat, AdvancedSettings> {
        const preset = PRESETS[presetId];

        if (!preset) {
            logger.warn('Unknown preset ID, using balanced', { presetId });
            return structuredClone(PRESETS[PresetId.BALANCED]);
        }

        return JSON.parse(JSON.stringify(preset));
    }

    /**
     * Detect which preset matches the given settings
     */
    detectPreset(formatPresets: Record<ImageFormat, AdvancedSettings>): PresetId {
        for (const [presetId, presetValues] of Object.entries(PRESETS)) {
            if (presetId === PresetId.CUSTOM) continue;

            if (this.presetsMatch(presetValues, formatPresets)) {
                return presetId as PresetId;
            }
        }

        return PresetId.CUSTOM;
    }

    /**
     * Compare two preset configurations
     */
    private presetsMatch(
        preset1: Record<ImageFormat, AdvancedSettings>,
        preset2: Record<ImageFormat, AdvancedSettings>
    ): boolean {
        for (const format of VALID_FORMATS) {
            const s1 = preset1[format];
            const s2 = preset2[format];

            if (!s1 || !s2) return false;

            if (
                s1.quality !== s2.quality ||
                s1.targetFormat !== s2.targetFormat ||
                s1.keepMetadata !== s2.keepMetadata ||
                s1.maxFileSize !== s2.maxFileSize
            ) {
                return false;
            }
        }

        return true;
    }

    /**
     * Validate settings structure
     */
    private validateSettings(settings: any): settings is BatchSettings {
        return validateSchema(settings).success;

    }

    /**
     * Load settings from store
     */
    async loadSettings(): Promise<BatchSettings> {
        try {
            const saved = await this.store.get<any>(SETTINGS_KEY);

            if (saved) {
                saved.globalPreset = this.migratePreset(saved.globalPreset);
                const defaults = this.getDefaultSettings();
                saved.resize ??= defaults.resize;
                saved.measureQuality ??= false;
                saved.formatPresets = { ...defaults.formatPresets, ...saved.formatPresets };

                if (this.validateSettings(saved)) {
                    return saved;
                }
            }
        } catch (error) {
            logger.error('Failed to load settings', { error });
        }

        return this.getDefaultSettings();
    }

    private migratePreset(oldPreset: any): PresetId {
        if (Object.values(PresetId).includes(oldPreset)) {
            return oldPreset;
        }

        const migration: Record<string, PresetId> = {
            'Balanced (80)': PresetId.BALANCED,
            'High Quality (95)': PresetId.HIGH_QUALITY,
            'Lossless': PresetId.LOSSLESS,
            'Custom': PresetId.CUSTOM
        };

        return migration[oldPreset] || PresetId.BALANCED;
    }

    /**
     * Save settings to store
     */
    async saveSettings(settings: BatchSettings): Promise<void> {
        try {
            if (!this.validateSettings(settings)) {
                throw new Error('Invalid settings structure');
            }

            await this.store.set(SETTINGS_KEY, settings);
            await this.store.save();

            logger.debug('Settings saved to store', { preset: settings.globalPreset });
        } catch (error) {
            logger.error('Failed to save settings', { error });
            throw new Error(`Settings save failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Update a specific format's advanced settings
     */
    updateFormatSettings(
        currentSettings: BatchSettings,
        format: ImageFormat,
        updates: Partial<AdvancedSettings>
    ): BatchSettings {
        if (!VALID_FORMATS.includes(format)) {
            logger.warn('Invalid format provided', { format });
            return currentSettings;
        }

        const newPresets = {
            ...currentSettings.formatPresets,
            [format]: {
                ...currentSettings.formatPresets[format],
                ...updates
            }
        };

        return {
            ...currentSettings,
            formatPresets: newPresets,
            globalPreset: this.detectPreset(newPresets)
        };
    }

    /**
     * Reset settings to defaults
     */
    async resetSettings(): Promise<BatchSettings> {
        const defaults = this.getDefaultSettings();
        await this.saveSettings(defaults);
        return defaults;
    }

    async loadPresets(): Promise<Record<string, BatchSettings>> {
        const saved = await this.store.get<Record<string, BatchSettings>>('named_presets') ?? {};
        return Object.fromEntries(Object.entries(saved).filter(([, value]) => this.validateSettings(value)));
    }

    async savePreset(name: string, settings: BatchSettings): Promise<Record<string, BatchSettings>> {
        if (!name.trim() || name.trim().length > 80 || !this.validateSettings(settings)) throw new Error('Invalid preset');
        const presets = { ...await this.loadPresets(), [name.trim()]: structuredClone(settings) };
        await this.store.set('named_presets', presets);
        await this.store.save();
        return presets;
    }

    async deletePreset(name: string): Promise<Record<string, BatchSettings>> {
        const presets = await this.loadPresets();
        delete presets[name];
        await this.store.set('named_presets', presets);
        await this.store.save();
        return presets;
    }

    /**
     * Cleanup (call on app unmount)
     */
    async cleanup(): Promise<void> {
        try {
            await this.store.save();
            logger.debug('Settings store cleaned up');
        } catch (error) {
            logger.error('Failed to cleanup settings store', { error });
        }
    }
}

export const settingsService = new SettingsService();

// ✅ Cleanup automático
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        settingsService.cleanup().catch(err => {
            console.error('Settings cleanup failed:', err);
        });
    });
}
