import { PresetId } from "../features/settings/services/SettingsService";

export type ImageFormat = 'JPG' | 'PNG' | 'WebP' | 'BMP';
export type ProcessStatus = 'Pending' | 'Processing' | 'Done' | 'Error';

export interface FileItem {
    id: string;
    name: string;
    path: string;
    size: number;
    format: ImageFormat;
    status: ProcessStatus;
    optimizedSize?: number;
    optimizedPath?: string;
    error?: string;
    selected: boolean;
}

export interface DiscoveryResult {
    items: FileItem[];
    errors: string[];
}

export interface BatchStats {
    totalFiles: number;
    totalSize: number;
    optimizedSize: number;
    startTime?: number;
    endTime?: number;
    formatBreakdown: Record<ImageFormat, number>;
}

export type OutputMode = 'ZIP' | 'Folder' | 'Replace' | 'Suffix';

export interface AdvancedSettings {
    targetFormat: 'Original' | ImageFormat;
    quality: number;
    maxFileSize?: number; // In KB
    keepMetadata: boolean;
}

export interface BatchSettings {
    globalPreset: PresetId;
    advancedMode: boolean;
    formatPresets: Record<ImageFormat, AdvancedSettings>;
    outputMode: OutputMode;
    outputZipName?: string;
    outputPath?: string;
    outputSuffix?: string;
}
