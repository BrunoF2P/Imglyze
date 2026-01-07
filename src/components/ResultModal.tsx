import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, ExternalLink, FileText, X, TrendingDown, Clock, Layers } from 'lucide-react';
import { BatchStats } from '../types';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';

interface ResultModalProps {
    isOpen: boolean;
    onClose: () => void;
    stats: BatchStats;
    successCount: number;
    failedCount: number;
}

export const ResultModal: React.FC<ResultModalProps> = ({
    isOpen,
    onClose,
    stats,
    successCount,
    failedCount
}) => {
    const { t } = useTranslation();
    if (!isOpen) return null;

    const savedSize = stats.totalSize - stats.optimizedSize;
    const savedPercent = Math.round((savedSize / stats.totalSize) * 100);

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-background/60"
                    onClick={onClose}
                />
                <motion.div
                    initial={{ scale: 0.98, opacity: 0, y: 10 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.98, opacity: 0, y: 10 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 400 }}
                    className="relative w-full max-w-xl bg-surface rounded-2xl overflow-hidden shadow-lg border border-text-main/10"
                >

                    <button
                        onClick={onClose}
                        className="absolute top-6 right-6 p-2 rounded-full hover:bg-text-main/10 transition-colors z-10"
                    >
                        <X className="w-5 h-5 text-text-muted" />
                    </button>

                    <div className="p-8">
                        <div className="flex flex-col items-center text-center mb-8">
                            <motion.div
                                initial={{ scale: 0.8 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.1, type: 'spring' }}
                                className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mb-4"
                            >
                                <CheckCircle2 className="w-8 h-8 text-green-500" />
                            </motion.div>
                            <h2 className="text-3xl font-bold mb-2 tracking-tight uppercase">{t('results.title')}</h2>
                            <p className="text-text-muted text-sm font-medium tracking-tight">{t('results.subtitle')}</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                            <div className="space-y-3">
                                <ResultRow icon={Layers} label={t('results.processed')} value={`${stats.totalFiles} ITEMS`} />
                                <ResultRow icon={CheckCircle2} label={t('results.successful')} value={successCount} color="text-green-400" />
                                <ResultRow icon={XCircle} label={t('results.failed')} value={failedCount} color="text-red-400" />
                                <ResultRow icon={Clock} label={t('results.totalTime')} value="8.2s" />
                            </div>

                            <motion.div
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.2 }}
                                className="bg-text-main/5 rounded-xl p-6 flex flex-col justify-center items-center border border-text-main/5 relative overflow-hidden group"
                            >
                                <TrendingDown className="w-8 h-8 text-primary mb-2 relative z-10" />
                                <p className="text-4xl font-bold text-primary tracking-tight mb-0.5 relative z-10">-{savedPercent}%</p>
                                <p className="text-[9px] font-bold uppercase tracking-wider text-text-muted mb-1 relative z-10">{t('results.totalSaved')}</p>
                                <p className="text-lg font-bold text-text-main relative z-10">{(savedSize / 1024 / 1024).toFixed(1)} MB</p>
                            </motion.div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <button className="btn-primary justify-center font-bold uppercase tracking-wider text-[10px]">
                                <ExternalLink className="w-3.5 h-3.5" />
                                {t('results.openOutput')}
                            </button>
                            <button className="btn-secondary justify-center font-bold uppercase tracking-wider text-[10px] border-text-main/5">
                                <FileText className="w-3.5 h-3.5" />
                                {t('results.viewLog')}
                            </button>
                            <button onClick={onClose} className="btn-secondary justify-center font-bold uppercase tracking-wider text-[10px] border-text-main/5">
                                {t('common.close')}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

const ResultRow = ({ icon: Icon, label, value, color }: any) => (
    <div className="flex items-center justify-between">
        <span className="flex items-center gap-2.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">
            <Icon className={cn("w-3.5 h-3.5", color)} />
            {label}
        </span>
        <span className={cn("font-bold text-xs tracking-tight", color)}>{value}</span>
    </div>
);
