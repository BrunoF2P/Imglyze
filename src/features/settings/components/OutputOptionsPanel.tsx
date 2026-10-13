import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../../lib/utils';
import { useTranslation } from 'react-i18next';
import { BatchSettings } from '../../../types';
import { ANIMATION_DELAYS, TYPOGRAPHY } from '../../../lib/constants';

interface OutputOptionsPanelProps {
    embedded?: boolean;
    settings: BatchSettings;
    onSettingsChange: (settings: BatchSettings) => void;
    onSelectOutputPath: () => void;
}

export const OutputOptionsPanel: React.FC<OutputOptionsPanelProps> = ({
    embedded,
    settings,
    onSettingsChange,
    onSelectOutputPath
}) => {
    const { t } = useTranslation();

    return (
        <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: ANIMATION_DELAYS.viewTransition + 0.1 }}
            className={embedded ? '' : 'panel'}
        >
            <h3 className={cn(TYPOGRAPHY.subHeading, "mb-4")}>
                {t('analysis.outputOptions')}
            </h3>

            <div className="space-y-4">
                {/* Output Mode Selection */}
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
                    {(['Folder', 'ZIP', 'Replace', 'Suffix'] as const).map((mode) => (
                        <button
                            key={mode}
                            aria-pressed={settings.outputMode === mode}
                            onClick={() => onSettingsChange({ ...settings, outputMode: mode })}
                            className={cn(
                                "p-3 rounded-xl border text-xs font-medium transition-all",
                                settings.outputMode === mode
                                    ? "bg-primary/10 border-primary/20 text-primary"
                                    : "bg-text-main/5 border-text-main/5 text-text-muted hover:bg-text-main/10 text-center"
                            )}
                        >
                            {mode === 'Folder' && t('analysis.exportFolder')}
                            {mode === 'ZIP' && t('analysis.exportZip')}
                            {mode === 'Replace' && t('analysis.overwrites')}
                            {mode === 'Suffix' && t('analysis.addSuffix')}
                        </button>
                    ))}
                </div>

                {/* Output Path Selection (for Folder mode) */}
                {(settings.outputMode === 'Folder' || settings.outputMode === 'ZIP') && (
                    <button
                        onClick={onSelectOutputPath}
                        className="w-full p-4 rounded-xl bg-text-main/5 border border-dashed border-text-main/20 hover:border-primary/50 transition-all group text-left"
                    >
                        <p className={cn(TYPOGRAPHY.label, "mb-1 group-hover:text-primary transition-colors")}>
                            {t('analysis.outputPath')}
                        </p>
                        <p className="text-xs font-bold text-text-main truncate">
                            {settings.outputPath || t('analysis.defaultOutput')}
                        </p>
                    </button>
                )}

                {/* ZIP Name Input */}
                {settings.outputMode === 'ZIP' && (
                    <div className="space-y-1.5">
                        <label htmlFor="output-zip-name" className={cn(TYPOGRAPHY.compactLabel, "text-text-muted")}>
                            {t('analysis.exportZip')}
                        </label>
                        <input
                            id="output-zip-name" type="text"
                            value={settings.outputZipName || ''}
                            onChange={(e) => onSettingsChange({ ...settings, outputZipName: e.target.value })}
                            placeholder="images_optimized.zip"
                            className="w-full bg-surface border border-text-main/10 rounded-lg px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-primary outline-none"
                        />
                    </div>
                )}

                {/* Suffix Input */}
                {settings.outputMode === 'Suffix' && (
                    <div className="space-y-1.5">
                        <label htmlFor="output-suffix" className={cn(TYPOGRAPHY.compactLabel, "text-text-muted")}>
                            {t('analysis.addSuffix')}
                        </label>
                        <input
                            id="output-suffix" type="text"
                            value={settings.outputSuffix || ''}
                            onChange={(e) => onSettingsChange({ ...settings, outputSuffix: e.target.value })}
                            placeholder="_opt"
                            className="w-full bg-surface border border-text-main/10 rounded-lg px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-primary outline-none"
                        />
                    </div>
                )}
            </div>
        </motion.section>
    );
};
