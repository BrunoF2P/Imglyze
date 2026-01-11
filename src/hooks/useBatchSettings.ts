import { useState, useCallback } from 'react';
import { BatchSettings, ImageFormat, AdvancedSettings } from '../types';
import { settingsService } from '../services';

/**
 * Custom hook for batch settings management
 * Encapsulates settings state and preset logic
 */
export const useBatchSettings = (initialPreset: string) => {
    const [settings, setSettings] = useState<BatchSettings>(() =>
        settingsService.getDefaultSettings(initialPreset)
    );

    // Apply a preset by name
    const applyPreset = useCallback((presetName: string) => {
        const presets = settingsService.applyPreset(presetName);
        if (presets) {
            setSettings(prev => ({
                ...prev,
                globalPreset: presetName,
                formatPresets: presets
            }));
        }
    }, []);

    // Update a specific format's settings
    const updateFormatSetting = useCallback((
        format: ImageFormat,
        updates: Partial<AdvancedSettings>
    ) => {
        setSettings(prev =>
            settingsService.updateFormatSettings(prev, format, updates)
        );
    }, []);

    // Toggle advanced mode
    const toggleAdvancedMode = useCallback(() => {
        setSettings(prev => ({
            ...prev,
            advancedMode: !prev.advancedMode
        }));
    }, []);

    // Update output settings
    const updateOutputSettings = useCallback((
        updates: Partial<Pick<BatchSettings, 'outputMode' | 'outputPath' | 'outputZipName' | 'outputSuffix'>>
    ) => {
        setSettings(prev => ({ ...prev, ...updates }));
    }, []);

    // Reset to defaults
    const resetSettings = useCallback(() => {
        setSettings(settingsService.getDefaultSettings(initialPreset));
    }, [initialPreset]);

    // Detect current preset
    const currentPreset = settingsService.detectPreset(settings.formatPresets);

    // Validation
    const isValid = settings.outputMode !== 'ZIP' || !!settings.outputZipName;

    return {
        settings,
        setSettings,
        applyPreset,
        updateFormatSetting,
        toggleAdvancedMode,
        updateOutputSettings,
        resetSettings,
        currentPreset,
        isValid
    };
};
