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
    error?: string;
    selected: boolean;
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

export interface BatchSettings {
    globalPreset: string;
    advancedMode: boolean;
    formatPresets: Record<ImageFormat, string>;
    outputMode: OutputMode;
    outputZipName?: string;
    outputPath?: string;
    outputSuffix?: string;
}
