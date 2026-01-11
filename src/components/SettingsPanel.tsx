import React from 'react';
import { Settings2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
import { useTranslation } from 'react-i18next';
import { BatchSettings } from '../types';
import { ANIMATION_DELAYS, TYPOGRAPHY, LAYOUT } from '../lib/constants';
import { FormatPresetEditor } from './FormatPresetEditor';

interface SettingsPanelProps {
    settings: BatchSettings;
    onSettingsChange: (settings: BatchSettings) => void;
    onAdvancedSettingUpdate: (format: any, updates: any) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
    settings,
    onSettingsChange,
    onAdvancedSettingUpdate
}) => {
    const { t } = useTranslation();

    return (
        <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: ANIMATION_DELAYS.viewTransition }}
            className={cn(LAYOUT.glass, LAYOUT.cardPadding, LAYOUT.largeBorderRadius)}
        >
            <h3 className={cn(TYPOGRAPHY.subHeading, "mb-4 flex items-center gap-2")}>
                <Settings2 className="w-5 h-5 text-primary" />
                {t('analysis.settingsTitle')}
            </h3>

            <div className="space-y-6">
                {/* Global Preset Selection */}
                <div>
                    <label className={cn(TYPOGRAPHY.label, "mb-3 tracking-wider block")}>
                        {t('analysis.globalPreset')}
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {[
                            t('analysis.presetBalanced'),
                            t('analysis.presetHigh'),
                            t('analysis.presetLossless'),
                            t('analysis.presetCustom')
                        ].map((p) => (
                            <button
                                key={p}
                                disabled={p === t('analysis.presetCustom')}
                                onClick={() => onSettingsChange({ ...settings, globalPreset: p })}
                                className={cn(
                                    "p-3 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all",
                                    settings.globalPreset === p
                                        ? "bg-primary/10 border-primary/20 text-primary"
                                        : "bg-text-main/5 border-text-main/5 text-text-muted hover:bg-text-main/10",
                                    p === t('analysis.presetCustom') && settings.globalPreset !== p && "hidden"
                                )}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Advanced Mode Toggle */}
                <div className="pt-6 border-t border-text-main/5">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h4 className="text-sm font-bold tracking-tight">
                                {t('analysis.advancedMode')}
                            </h4>
                            <p className="text-[10px] text-text-muted font-medium">
                                {t('analysis.advancedDesc')}
                            </p>
                        </div>
                        <button
                            onClick={() => onSettingsChange({
                                ...settings,
                                advancedMode: !settings.advancedMode
                            })}
                            className={cn(
                                "w-12 h-6 rounded-full transition-colors relative",
                                settings.advancedMode ? "bg-primary" : "bg-text-main/10"
                            )}
                        >
                            <motion.div
                                animate={{ x: settings.advancedMode ? 26 : 4 }}
                                className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                            />
                        </button>
                    </div>

                    {/* Advanced Format Editors */}
                    {settings.advancedMode && (
                        <FormatPresetEditor
                            settings={settings}
                            onUpdate={onAdvancedSettingUpdate}
                        />
                    )}
                </div>
            </div>
        </motion.section>
    );
};
