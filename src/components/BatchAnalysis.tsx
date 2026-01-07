import React from 'react';
import { BarChart3, Settings2, Play, CheckCircle2, ChevronRight } from 'lucide-react';
import { BatchStats, BatchSettings } from '../types';
import { cn } from '../lib/utils';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

interface BatchAnalysisProps {
    stats: BatchStats;
    settings: BatchSettings;
    setSettings: (settings: BatchSettings) => void;
    onStart: () => void;
}

export const BatchAnalysis: React.FC<BatchAnalysisProps> = ({ stats, settings, setSettings, onStart }) => {
    const { t } = useTranslation();

    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0 }
    };

    return (
        <div className="w-full max-w-5xl mx-auto flex flex-col gap-8">
            <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center justify-between"
            >
                <h2 className="text-2xl font-bold flex items-center gap-3 tracking-tight">
                    <BarChart3 className="text-primary w-6 h-6" />
                    {t('analysis.title')}
                </h2>
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onStart}
                    className="btn-primary"
                >
                    {t('analysis.startProcessing')}
                    <Play className="w-5 h-5 fill-current" />
                </motion.button>
            </motion.div>

            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 md:grid-cols-4 gap-4"
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
                <motion.div variants={itemVariants} className="glass p-5 rounded-xl flex flex-col justify-between">
                    <p className="text-text-muted text-[10px] font-bold uppercase tracking-wider mb-2">{t('analysis.formats')}</p>
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
                <motion.div
                    variants={itemVariants}
                    className="glass p-5 rounded-xl border-primary/10 bg-gradient-to-br from-primary/[0.03] to-transparent"
                >
                    <p className="text-primary text-[10px] font-bold uppercase tracking-wider mb-1">{t('analysis.estimatedFinal')}</p>
                    <p className="text-2xl font-bold tracking-tight">~{(stats.totalSize * 0.15 / 1024 / 1024).toFixed(2)} MB</p>
                </motion.div>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <motion.section
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="glass p-6 rounded-2xl"
                    >
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <Settings2 className="w-5 h-5 text-primary" />
                            {t('analysis.settingsTitle')}
                        </h3>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-bold text-text-muted mb-3 uppercase tracking-wider">{t('analysis.globalPreset')}</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['WebP 80 (Balanced)', 'WebP 95 (High Quality)', 'PNG (Lossless)'].map((p) => (
                                        <button
                                            key={p}
                                            onClick={() => setSettings({ ...settings, globalPreset: p })}
                                            className={cn(
                                                "p-3 rounded-xl border transition-all text-[10px] font-bold",
                                                settings.globalPreset === p
                                                    ? "bg-primary text-background border-primary shadow-md"
                                                    : "bg-text-main/5 border-text-main/5 hover:bg-text-main/10"
                                            )}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <motion.div
                                whileHover={{ scale: 1.005 }}
                                className="flex items-center gap-4 p-4 rounded-xl bg-text-main/5 border border-text-main/5 transition-colors hover:border-text-main/10"
                            >
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        id="advanced"
                                        className="w-5 h-5 rounded border-2 border-text-main/20 bg-transparent text-primary focus:ring-primary transition-all cursor-pointer appearance-none checked:bg-primary"
                                        checked={settings.advancedMode}
                                        onChange={(e) => setSettings({ ...settings, advancedMode: e.target.checked })}
                                    />
                                    {settings.advancedMode && <CheckCircle2 className="w-3.5 h-3.5 text-background absolute top-0.5 left-0.5 pointer-events-none" />}
                                </div>
                                <div className="cursor-pointer" onClick={() => setSettings({ ...settings, advancedMode: !settings.advancedMode })}>
                                    <label htmlFor="advanced" className="text-sm font-bold block cursor-pointer">{t('analysis.advancedMode')}</label>
                                    <p className="text-[10px] text-text-muted font-medium">{t('analysis.advancedDesc')}</p>
                                </div>
                            </motion.div>
                        </div>
                    </motion.section>

                    <motion.section
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="glass p-6 rounded-2xl"
                    >
                        <h3 className="text-lg font-bold mb-4">{t('analysis.outputOptions')}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {[
                                { id: 'ZIP', label: t('analysis.exportZip'), icon: ChevronRight },
                                { id: 'Folder', label: t('analysis.exportFolder'), icon: ChevronRight },
                                { id: 'Replace', label: t('analysis.overwrites'), icon: ChevronRight },
                                { id: 'Suffix', label: t('analysis.addSuffix'), icon: ChevronRight },
                            ].map((mode) => (
                                <button
                                    key={mode.id}
                                    onClick={() => setSettings({ ...settings, outputMode: mode.id as any })}
                                    className={cn(
                                        "p-4 rounded-xl border flex items-center justify-between transition-all group",
                                        settings.outputMode === mode.id
                                            ? "bg-accent/5 border-accent/10 text-accent shadow-sm"
                                            : "bg-surface border-text-main/5 hover:bg-text-main/10"
                                    )}
                                >
                                    <span className="font-bold text-xs">{mode.label}</span>
                                    <mode.icon className={cn(
                                        "w-4 h-4 transition-transform group-hover:translate-x-1",
                                        settings.outputMode === mode.id ? "text-accent" : "text-text-muted/30"
                                    )} />
                                </button>
                            ))}
                        </div>
                    </motion.section>
                </div>

                <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 }}
                    className="glass rounded-2xl overflow-hidden flex flex-col h-full min-h-[400px] border border-text-main/5"
                >
                    <div className="p-4 border-b border-text-main/5 flex items-center justify-between bg-text-main/[0.02]">
                        <span className="font-bold text-[10px] uppercase tracking-wider">{t('analysis.fileListPreview')}</span>
                        <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-[9px] font-bold">{stats.totalFiles}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                        {[...Array(Math.min(stats.totalFiles, 30))].map((_, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.5 + (i * 0.02) }}
                                className="flex items-center gap-3 p-3 rounded-lg hover:bg-text-main/5 transition-all border border-transparent hover:border-text-main/5 group cursor-default"
                            >
                                <div className="w-8 h-8 rounded-lg bg-text-main/5 flex items-center justify-center text-[9px] font-bold border border-text-main/5 group-hover:bg-primary/5 group-hover:text-primary transition-colors uppercase">IMG</div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-bold truncate tracking-tight uppercase">image_{String(i + 1).padStart(3, '0')}.jpg</p>
                                    <p className="text-[9px] text-text-muted font-medium tracking-wide">1.2 MB</p>
                                </div>
                                <CheckCircle2 className="w-4 h-4 text-text-muted/10 group-hover:text-primary/20 transition-colors" />
                            </motion.div>
                        ))}
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

const StatCard = ({ label, value, variants }: any) => (
    <motion.div variants={variants} className="glass p-5 rounded-xl hover:border-text-main/10 transition-colors group">
        <p className="text-text-muted text-[10px] font-bold uppercase tracking-wider mb-2 group-hover:text-text-main transition-colors">{label}</p>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
    </motion.div>
);
