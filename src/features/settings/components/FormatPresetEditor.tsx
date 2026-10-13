import React, { useState } from 'react';
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
    const { stats } = useBatch();
    const formats = (Object.keys(stats.formatBreakdown) as ImageFormat[])
        .filter(format => stats.formatBreakdown[format] > 0);
    const [selectedFormat, setSelectedFormat] = useState<ImageFormat | null>(null);
    const activeFormat = selectedFormat && formats.includes(selectedFormat) ? selectedFormat : formats[0];

    return (
        <AnimatePresence>
            <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-3 pt-4 border-t border-text-main/5"
            >
                <div className="flex flex-wrap gap-2" aria-label={t('comparison.format')}>
                    {formats.map(format => (
                        <button
                            key={format}
                            type="button"
                            aria-pressed={activeFormat === format}
                            onClick={() => setSelectedFormat(format)}
                            className={cn('px-3 py-2 rounded-lg text-sm border transition-colors',
                                activeFormat === format ? 'bg-primary/15 border-primary/40 text-primary' : 'border-text-main/10 text-text-muted hover:text-text-main')}
                        >
                            {format} <span className="ml-1 opacity-70">{stats.formatBreakdown[format]}</span>
                        </button>
                    ))}
                </div>
                {formats.filter(format => format === activeFormat).map((fmt) => {
                        const isUsingMaxSize = !!settings.formatPresets[fmt].maxFileSize;


                        return (
                            <div
                                key={fmt}
                                className="p-4 rounded-xl bg-text-main/[0.02] border border-text-main/5 group hover:border-primary/20 transition-colors"
                            >
                                <div className="flex flex-col gap-4">
                                    <div className="flex items-center gap-3 w-full">
                                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex flex-col items-center justify-center border border-primary/10">
                                            <span className="text-[10px] font-black text-primary leading-none">{fmt}</span>
                                            <span className="text-[8px] font-bold text-primary/60 mt-0.5">
                                                {stats.formatBreakdown[fmt]}x
                                            </span>
                                        </div>
                                        <ChevronRight className="w-3 h-3 text-text-muted/30 group-hover:text-primary/40 transition-colors" />
                                        <select
                                            aria-label={`${fmt} — ${t('comparison.format')}`}
                                            value={settings.formatPresets[fmt].targetFormat}
                                            onChange={(e) => onUpdate(fmt, { targetFormat: e.target.value as AdvancedSettings['targetFormat'] })}
                                            className="bg-surface border border-text-main/10 rounded-lg px-2 py-1.5 text-[11px] font-bold text-text-main focus:ring-1 focus:ring-primary outline-none cursor-pointer transition-colors"
                                        >
                                            <option value="Original">{t('analysis.keepOriginal')}</option>
                                            <option value="JPG">JPG</option>
                                            <option value="PNG">PNG</option>
                                            <option value="WebP">WebP</option>
                                            <option value="AVIF">AVIF</option>
                                            <option value="BMP">BMP</option>
                                        </select>
                                    </div>

                                    <div className="flex-1 grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between items-center">
                                                <label className={cn(TYPOGRAPHY.compactLabel, "text-text-muted")}>
                                                    {t('analysis.quality')}
                                                </label>
                                                <span className="text-[10px] font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                                    {settings.formatPresets[fmt].quality}%
                                                </span>
                                            </div>
                                            <input
                                                aria-label={`${fmt} — ${t('analysis.quality')}`}
                                                type="range"
                                                min="1"
                                                max="100"
                                                value={settings.formatPresets[fmt].quality}
                                                onChange={(e) => onUpdate(fmt, { quality: parseInt(e.target.value) })}
                                                className="w-full h-1 bg-text-main/10 rounded-lg appearance-none cursor-pointer accent-primary"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <div className="flex justify-between items-center">
                                                <label className={cn(TYPOGRAPHY.compactLabel, "text-text-muted")}>
                                                    {t('analysis.maxSize')}
                                                </label>
                                            </div>
                                            <div className="relative">
                                                <input
                                                    aria-label={`${fmt} — ${t('analysis.maxSize')}`}
                                                    min={1} step={1}
                                                    type="number"
                                                    placeholder={t('analysis.noLimit')}
                                                    value={settings.formatPresets[fmt].maxFileSize || ''}
                                                    onChange={(e) => {
                                                        const val = e.target.value ? parseInt(e.target.value) : undefined;
                                                        if (val !== undefined && (!Number.isFinite(val) || val <= 0)) return;
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
