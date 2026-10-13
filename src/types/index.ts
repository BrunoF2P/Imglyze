import { PresetId } from "../features/settings/services/SettingsService";

export type ImageFormat = 'JPG' | 'PNG' | 'WebP' | 'BMP' | 'AVIF' | 'SVG';
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
    fidelity?: number;
    relativePath?: string;
    originalPreview?: string;
    previewPending?: boolean;
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
    targetFormat: 'Original' | Exclude<ImageFormat, 'SVG'>;
    quality: number;
    maxFileSize?: number; // In KB
    keepMetadata: boolean;
}

export interface ResizeSettings {
    mode: 'Original' | 'Fit' | 'Percent';
    width: number;
    height: number;
    percent: number;
    filter: 'Lanczos3' | 'CatmullRom';
}

export interface BatchOutcome {
    cancelled: boolean;
    successes: number;
    errors: number;
    outputPath?: string;
}

export interface BatchSettings {
    resize: ResizeSettings;
    measureQuality: boolean;
    globalPreset: PresetId;
    advancedMode: boolean;
    formatPresets: Record<ImageFormat, AdvancedSettings>;
    outputMode: OutputMode;
    outputZipName?: string;
    outputPath?: string;
    outputSuffix?: string;
}
