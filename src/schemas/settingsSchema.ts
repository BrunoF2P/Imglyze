import { z } from 'zod';

// Enums that match the TypeScript/Rust logic
export const ImageFormatSchema = z.enum(['JPG', 'PNG', 'WebP', 'BMP']);
export const OutputModeSchema = z.enum(['ZIP', 'Folder', 'Replace', 'Suffix']);

// Advanced Settings Schema
export const AdvancedSettingsSchema = z.object({
    targetFormat: z.string(), // "Original" or specific format
    quality: z.number().min(0).max(100),
    maxFileSize: z.number().positive().nullish(),
    keepMetadata: z.boolean(),
});

// Map of presets: Key is string (format enum), Value is AdvancedSettings
export const FormatPresetsSchema = z.record(
    z.string(),
    AdvancedSettingsSchema
);

// Main BatchSettings Schema
export const BatchSettingsSchema = z.object({
    globalPreset: z.string(),
    advancedMode: z.boolean(),
    formatPresets: FormatPresetsSchema,
    outputMode: OutputModeSchema,
    outputFormat: ImageFormatSchema.nullish(),
    outputZipName: z.string().nullish(),
    outputPath: z.string().nullish(),
    outputSuffix: z.string().nullish(),
});

export type ValidBatchSettings = z.infer<typeof BatchSettingsSchema>;

// Helper to validate safely
export const validateSettings = (data: unknown) => {
    return BatchSettingsSchema.safeParse(data);
};
