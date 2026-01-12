import React, { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../../lib/utils';
import { useTranslation } from 'react-i18next';
import { BatchSettings, ImageFormat, AdvancedSettings } from '../../../types';
import { TYPOGRAPHY } from '../../../lib/constants';
import { useBatch } from '../../../contexts/BatchContext';

interface FormatPresetEditorProps {
    settings: BatchSettings;
    onUpdate: (format: ImageFormat, updates: Partial<AdvancedSettings>) => void;
}

export const FormatPresetEditor: React.FC<FormatPresetEditorProps> = ({ settings, onUpdate }) => {
    const { t } = useTranslation();
    const { stats, files } = useBatch();

    const minSizesPerFormat = useMemo(() => {
        const minSizes: Record<string, number> = {};
        files.forEach(f => {
            if (!minSizes[f.format] || f.size < minSizes[f.format]) {
                minSizes[f.format] = f.size;
            }
        });
        return minSizes;
    }, [files]);

    return (
        <AnimatePresence>
            <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden space-y-3 pt-4 border-t border-text-main/5"
            >
                {(Object.keys(stats.formatBreakdown) as ImageFormat[])
                    .filter(fmt => stats.formatBreakdown[fmt] > 0)
                    .map((fmt) => {
                        const isUsingMaxSize = !!settings.formatPresets[fmt].maxFileSize;
                        const minOrigSizeKB = Math.floor(minSizesPerFormat[fmt] / 1024);

                        return (
                            <div
                                key={fmt}
                                className="p-4 rounded-xl bg-text-main/[0.02] border border-text-main/5 group hover:border-primary/20 transition-colors"
                            >
                                <div className="flex flex-col md:flex-row md:items-center gap-6">
                                    {/* Format Badge and Target Selection */}
                                    <div className="flex items-center gap-3 min-w-[140px]">
                                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex flex-col items-center justify-center border border-primary/10">
                                            <span className="text-[10px] font-black text-primary leading-none">{fmt}</span>
                                            <span className="text-[8px] font-bold text-primary/60 mt-0.5">
                                                {stats.formatBreakdown[fmt]}x
                                            </span>
                                        </div>
                                        <ChevronRight className="w-3 h-3 text-text-muted/30 group-hover:text-primary/40 transition-colors" />
                                        <select
                                            value={settings.formatPresets[fmt].targetFormat}
                                            onChange={(e) => onUpdate(fmt, { targetFormat: e.target.value as any })}
                                            className="bg-surface border border-text-main/10 rounded-lg px-2 py-1.5 text-[11px] font-bold text-text-main focus:ring-1 focus:ring-primary outline-none cursor-pointer transition-colors"
                                        >
                                            <option value="Original">{t('analysis.keepOriginal')}</option>
                                            <option value="JPG">JPG</option>
                                            <option value="PNG">PNG</option>
                                            <option value="WebP">WebP</option>
                                        </select>
                                    </div>

                                    {/* Quality and Max Size Controls */}
                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Quality Slider */}
                                        <div className={cn(
                                            "space-y-1.5 transition-opacity",
                                            isUsingMaxSize ? "opacity-30 pointer-events-none" : "opacity-100"
                                        )}>
                                            <div className="flex justify-between items-center">
                                                <label className={cn(TYPOGRAPHY.compactLabel, "text-text-muted")}>
                                                    {t('analysis.quality')}
                                                </label>
                                                <span className="text-[10px] font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                                    {settings.formatPresets[fmt].quality}%
                                                </span>
                                            </div>
                                            <input
                                                type="range"
                                                min="10"
                                                max="100"
                                                value={settings.formatPresets[fmt].quality}
                                                onChange={(e) => onUpdate(fmt, { quality: parseInt(e.target.value) })}
                                                className="w-full h-1 bg-text-main/10 rounded-lg appearance-none cursor-pointer accent-primary"
                                            />
                                        </div>

                                        {/* Max File Size Input */}
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between items-center">
                                                <label className={cn(TYPOGRAPHY.compactLabel, "text-text-muted")}>
                                                    {t('analysis.maxSize')}
                                                </label>
                                            </div>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    placeholder={t('analysis.noLimit')}
                                                    value={settings.formatPresets[fmt].maxFileSize || ''}
                                                    onChange={(e) => {
                                                        const val = e.target.value ? parseInt(e.target.value) : undefined;
                                                        if (val && val > minOrigSizeKB) return;
                                                        onUpdate(fmt, { maxFileSize: val });
                                                    }}
                                                    className={cn(
                                                        "w-full bg-surface border border-text-main/10 rounded-lg pl-3 pr-8 py-1.5 text-[11px] font-bold focus:ring-1 focus:ring-primary outline-none transition-colors",
                                                        isUsingMaxSize && "border-primary/30 ring-1 ring-primary/20"
                                                    )}
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-text-muted uppercase">
                                                    KB
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Keep Metadata Checkbox */}
                                <div className="pt-3 border-t border-text-main/5 mt-3">
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <input
                                            type="checkbox"
                                            checked={settings.formatPresets[fmt].keepMetadata}
                                            onChange={(e) => onUpdate(fmt, { keepMetadata: e.target.checked })}
                                            className="w-4 h-4 rounded border-text-main/20 text-primary focus:ring-primary focus:ring-offset-0 cursor-pointer"
                                        />
                                        <span className={cn(TYPOGRAPHY.compactLabel, "text-text-muted group-hover:text-primary transition-colors")}>
                                            {t('analysis.keepMetadata')}
                                        </span>
                                    </label>
                                </div>
                            </div>
                        );
                    })}
            </motion.div>
        </AnimatePresence>
    );
};
