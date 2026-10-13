import { z } from 'zod';

// Enums that match the TypeScript/Rust logic
export const ImageFormatSchema = z.enum(['JPG', 'PNG', 'WebP', 'BMP', 'AVIF', 'SVG']);
export const OutputModeSchema = z.enum(['ZIP', 'Folder', 'Replace', 'Suffix']);

// Advanced Settings Schema
export const AdvancedSettingsSchema = z.object({
    targetFormat: z.enum(['Original', 'JPG', 'PNG', 'WebP', 'BMP', 'AVIF']), // "Original" or specific format
    quality: z.number().min(1).max(100),
    maxFileSize: z.number().int().positive().max(Number.MAX_SAFE_INTEGER / 1024).nullish(),
    keepMetadata: z.boolean(),
});

// Map of presets: Key is string (format enum), Value is AdvancedSettings
export const FormatPresetsSchema = z.record(
    ImageFormatSchema,
    AdvancedSettingsSchema
);

// Main BatchSettings Schema
export const BatchSettingsSchema = z.object({
    resize: z.object({
        mode: z.enum(['Original', 'Fit', 'Percent']),
        width: z.number().int().positive().max(32768),
        height: z.number().int().positive().max(32768),
        percent: z.number().positive().max(100),
        filter: z.enum(['Lanczos3', 'CatmullRom']),
    }),
    measureQuality: z.boolean(),
    globalPreset: z.enum(['balanced', 'high_quality', 'lossless', 'custom']),
    advancedMode: z.boolean(),
    formatPresets: FormatPresetsSchema,
    outputMode: OutputModeSchema,
    outputFormat: ImageFormatSchema.nullish(),
    outputZipName: z.string().regex(/^[^/\\]+$/).refine(s => s !== '.' && s !== '..').nullish(),
    outputPath: z.string().nullish(),
    outputSuffix: z.string().regex(/^[^/\\]+$/).refine(s => s !== '.' && s !== '..').nullish(),
});

export type ValidBatchSettings = z.infer<typeof BatchSettingsSchema>;

// Helper to validate safely
export const validateSettings = (data: unknown) => {
    return BatchSettingsSchema.safeParse(data);
};
