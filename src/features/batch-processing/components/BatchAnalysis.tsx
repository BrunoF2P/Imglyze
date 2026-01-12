import React from 'react';
import { BarChart3, Play } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { StatCard } from '../../../components/ui/StatCard';
import { FileListPanel } from './FileListPanel';
import { convertFileSrc } from '@tauri-apps/api/core';
import { SettingsPanel } from '../../settings/components/SettingsPanel';
import { OutputOptionsPanel } from '../../settings/components/OutputOptionsPanel';

import { useBatch } from '../../../contexts/BatchContext';
import { ANIMATION_DELAYS, TYPOGRAPHY, LAYOUT } from '../../../lib/constants';

/**
 * BatchAnalysis component - orchestrates analysis view with stats, settings, and file list
 */
export const BatchAnalysis: React.FC = () => {
    const {
        stats,
        settings,
        files,
        setSettings,
        triggerOutputPathSelection,
        removeFile,
        reorderFiles,
        sortFiles,
        updateAdvancedSetting,
        startProcessing
    } = useBatch();
    const { t } = useTranslation();

    const [hoveredFile, setHoveredFile] = React.useState<string | null>(null);

    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: ANIMATION_DELAYS.itemStagger
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0 }
    };

    const isStartDisabled = files.filter(f => f.selected).length === 0 ||
        (settings.outputMode === 'ZIP' && !settings.outputZipName);

    return (
        <div className="w-full max-w-5xl mx-auto flex flex-col gap-8 relative">
            {/* Enlarged File Preview on Hover */}
            <AnimatePresence>
                {hoveredFile && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.1 }}
                        className="fixed z-50 pointer-events-none drop-shadow-2xl"
                        style={{
                            left: '50%',
                            top: '50%',
                            transform: 'translate(-50%, -50%)',
                        }}
                    >
                        <div className="bg-background/80 backdrop-blur-xl p-2 rounded-2xl border border-white/20 shadow-2xl">
                            <img
                                src={convertFileSrc(hoveredFile)}
                                alt="Preview"
                                className="max-w-[400px] max-h-[400px] object-contain rounded-xl"
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header with Title and Start Button */}
            <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center justify-between"
            >
                <h2 className={TYPOGRAPHY.heading + " flex items-center gap-3"}>
                    <BarChart3 className="text-primary w-6 h-6" />
                    {t('analysis.title')}
                </h2>

                <button
                    disabled={isStartDisabled}
                    onClick={startProcessing}
                    className={cn(
                        "flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                        isStartDisabled
                            ? "bg-text-main/5 text-text-muted opacity-50 cursor-not-allowed"
                            : "bg-primary text-white hover:bg-primary-hover shadow-lg shadow-primary/20 active:scale-95"
                    )}
                >
                    <Play className="w-4 h-4 fill-current" />
                    {t('analysis.startProcessing')}
                </button>
            </motion.div>

            {/* Stats Cards */}
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 md:grid-cols-3 gap-4"
            >
                <StatCard
                    variants={itemVariants}
                    label={t('analysis.totalFiles')}
                    value={stats.totalFiles}
                />
                <StatCard
                    variants={itemVariants}
                    label={t('analysis.totalSize')}
                    value={`${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`}
                />
                <motion.div
                    variants={itemVariants}
                    className={cn(LAYOUT.glass, LAYOUT.statCardPadding, LAYOUT.borderRadius, "flex flex-col justify-between")}
                >
                    <p className={TYPOGRAPHY.label}>{t('analysis.formats')}</p>
                    <div className="flex gap-2 flex-wrap">
                        {Object.entries(stats.formatBreakdown).map(([format, count]) => (
                            count > 0 && (
                                <span key={format} className="px-2 py-0.5 bg-text-main/5 rounded text-[10px] font-bold border border-text-main/5">
                                    {count}x {format}
                                </span>
                            )
                        ))}
                    </div>
                </motion.div>
            </motion.div>

            {/* Main Content Grid: Settings + File List */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column - Settings and Output Options */}
                <div className="lg:col-span-2 space-y-8">
                    <SettingsPanel
                        settings={settings}
                        onSettingsChange={setSettings}
                        onAdvancedSettingUpdate={updateAdvancedSetting}
                    />

                    <OutputOptionsPanel
                        settings={settings}
                        onSettingsChange={setSettings}
                        onSelectOutputPath={triggerOutputPathSelection}
                    />
                </div>

                {/* Right Column - File List */}
                <div className="lg:col-span-1">
                    <FileListPanel
                        files={files}
                        onRemoveFile={removeFile}
                        onReorderFiles={reorderFiles}
                        onSortFiles={sortFiles}
                        onHoverFile={setHoveredFile}
                    />
                </div>
            </div>
        </div>
    );
};
