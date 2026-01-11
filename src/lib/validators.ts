import { BatchSettings, FileItem } from '../types';

export interface ValidationResult {
    isValid: boolean;
    error?: string;
}

export const validateBatchSettings = (settings: BatchSettings): ValidationResult => {
    // Check Output Path (if mandatory in current mode)
    if (settings.outputMode === 'Folder' || settings.outputMode === 'ZIP') {
        // Note: If outputPath is purely optional and defaults to temp, this check might be relaxed.
        // But usually explicit path or default handling is fine. 
        // For now, checks if zip name is valid if zip mode
        if (settings.outputMode === 'ZIP' && !settings.outputZipName?.trim()) {
            return { isValid: false, error: 'Zip filename is required.' };
        }
    }

    // Check Quality Values in Presets
    for (const [format, config] of Object.entries(settings.formatPresets)) {
        if (config.quality < 0 || config.quality > 100) {
            return { isValid: false, error: `Invalid quality for ${format}: must be between 0 and 100.` };
        }
        if (config.maxFileSize !== undefined && config.maxFileSize <= 0) {
            return { isValid: false, error: `Invalid max file size for ${format}: must be greater than 0.` };
        }
    }

    return { isValid: true };
};

export const validateFileSelection = (files: FileItem[]): ValidationResult => {
    if (files.length === 0) {
        return { isValid: false, error: 'No files selected.' };
    }

    const selectedFiles = files.filter(f => f.selected);
    if (selectedFiles.length === 0) {
        return { isValid: false, error: 'No files selected for processing.' };
    }

    return { isValid: true };
};
