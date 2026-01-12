import { useState, useCallback } from 'react';
import { BatchSettings, ImageFormat, AdvancedSettings } from '../../../types';
import { PresetId, settingsService } from '../services/SettingsService';

/**
 * Custom hook for batch settings management
 * Encapsulates settings state and preset logic
 */
export const useBatchSettings = () => {
    const [settings, setSettings] = useState<BatchSettings>(() =>
        settingsService.getDefaultSettings()
    );

    // Apply a preset by name
    const applyPreset = useCallback((presetId: PresetId) => {
        const presets = settingsService.applyPreset(presetId);
        if (presets) {
            setSettings(prev => ({
                ...prev,
                globalPreset: presetId,
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
        setSettings(settingsService.getDefaultSettings());
    }, []);

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
