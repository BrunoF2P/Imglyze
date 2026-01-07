import React from 'react';
import { Loader2, Clock, Zap, Target, CheckCircle2, AlertCircle, Pause, Play, XCircle } from 'lucide-react';
import { FileItem, BatchStats, ProcessStatus } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

interface ProcessingViewProps {
    files: FileItem[];
    overallProgress: number;
    stats: BatchStats;
    isPaused: boolean;
    onPauseToggle: () => void;
    onCancel: () => void;
}

export const ProcessingView: React.FC<ProcessingViewProps> = ({
    files,
    overallProgress,
    stats,
    isPaused,
    onPauseToggle,
    onCancel
}) => {
    const { t } = useTranslation();

    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
    };

    return (
        <div className="w-full max-w-6xl mx-auto flex flex-col gap-6">
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold flex items-center gap-3 tracking-tight">
                        {isPaused ? <Pause className="text-yellow-500 w-6 h-6" /> : <Loader2 className="animate-spin text-primary w-6 h-6" />}
                        {isPaused ? t('processing.paused') : t('processing.working')}
                    </h2>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onPauseToggle}
                            className="btn-secondary"
                        >
                            {isPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4 fill-current" />}
                            {isPaused ? t('common.resume') : t('common.pause')}
                        </button>
                        <button
                            onClick={onCancel}
                            className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl font-bold uppercase tracking-wider text-[10px] transition-all flex items-center gap-2 border border-red-500/20"
                        >
                            <XCircle className="w-4 h-4" />
                            {t('common.cancel')}
                        </button>
                    </div>
                </div>

                <div className="relative">
                    <div className="w-full h-4 bg-text-main/5 rounded-full overflow-hidden border border-text-main/5 p-1">
                        <motion.div
                            className="h-full bg-primary rounded-full relative overflow-hidden"
                            initial={{ width: 0 }}
                            animate={{ width: `${overallProgress}%` }}
                            transition={{ type: 'spring', bounce: 0, duration: 1 }}
                        />
                    </div>
                    <div className="flex justify-between mt-2 text-[10px] text-text-muted font-bold uppercase tracking-wider">
                        <span>{t('processing.filesProcessed', { count: files.filter(f => f.status === 'Done').length, total: files.length })}</span>
                        <span className="text-primary">{overallProgress.toFixed(1)}%</span>
                    </div>
                </div>
            </div>

            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 md:grid-cols-4 gap-4"
            >
                <StatCard variants={itemVariants} icon={Clock} label={t('processing.timeElapsed')} value="00:12" />
                <StatCard variants={itemVariants} icon={Target} label={t('processing.estimatedTime')} value="00:45" />
                <StatCard variants={itemVariants} icon={Zap} label={t('processing.speed')} value="2.4 files/s" />
                <StatCard
                    variants={itemVariants}
                    icon={CheckCircle2}
                    label={t('processing.saved')}
                    value={`${(stats.totalSize - stats.optimizedSize) > 0 ? ((stats.totalSize - stats.optimizedSize) / 1024 / 1024).toFixed(1) : '0.0'} MB`}
                    highlight
                />
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="glass rounded-2xl overflow-hidden flex flex-col flex-1 min-h-[400px] border border-text-main/5"
            >
                <div className="p-4 border-b border-text-main/5 flex items-center bg-text-main/[0.02] text-[10px] font-bold uppercase tracking-wider text-text-muted">
                    <div className="w-12"></div>
                    <div className="flex-1">{t('processing.filename')}</div>
                    <div className="w-24 text-right">{t('processing.original')}</div>
                    <div className="w-24 text-right">{t('processing.optimized')}</div>
                    <div className="w-24 text-right">{t('processing.reduction')}</div>
                    <div className="w-36 text-center">{t('processing.status')}</div>
                </div>
                <div className="overflow-y-auto flex-1 custom-scrollbar">
                    <AnimatePresence initial={false} mode="popLayout">
                        {files.map((file) => (
                            <motion.div
                                layout
                                key={file.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex items-center p-4 border-b border-text-main/5 hover:bg-text-main/[0.03] transition-colors group"
                            >
                                <div className="w-12 flex justify-center">
                                    <span className="px-2 py-0.5 rounded-md bg-text-main/5 text-[9px] font-bold border border-text-main/5 group-hover:bg-primary/10 group-hover:text-primary transition-colors">{file.format}</span>
                                </div>
                                <div className="flex-1 min-w-0 pr-4">
                                    <p className="text-[11px] font-bold truncate tracking-tight uppercase">{file.name}</p>
                                </div>
                                <div className="w-24 text-right text-[10px] font-medium text-text-muted">
                                    {(file.size / 1024).toFixed(0)} KB
                                </div>
                                <div className="w-24 text-right text-[11px] font-bold">
                                    {file.optimizedSize ? `${(file.optimizedSize / 1024).toFixed(0)} KB` : <span className="text-text-muted opacity-20">--</span>}
                                </div>
                                <div className="w-24 text-right">
                                    {file.optimizedSize && (
                                        <motion.span
                                            initial={{ scale: 0.8, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            className="text-[9px] font-bold text-green-400 bg-green-400/10 px-2 py-0.5 rounded border border-green-400/10"
                                        >
                                            -{Math.round((1 - file.optimizedSize / file.size) * 100)}%
                                        </motion.span>
                                    )}
                                </div>
                                <div className="w-36 flex justify-center">
                                    <StatusBadge status={file.status} />
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
};

const StatCard = ({ icon: Icon, label, value, highlight, variants }: any) => (
    <motion.div
        variants={variants}
        className={cn(
            "glass p-5 rounded-xl flex items-center gap-4 transition-all group border border-text-main/5",
            highlight ? "bg-gradient-to-br from-green-500/[0.02] to-transparent border-green-500/10" : "hover:border-text-main/5"
        )}
    >
        <div className={cn(
            "p-2.5 rounded-lg transition-colors border border-transparent",
            highlight ? "bg-green-500/10 text-green-400 border-green-500/10" : "bg-text-main/5 text-text-muted group-hover:bg-primary/5 group-hover:text-primary group-hover:border-primary/10"
        )}>
            <Icon className="w-5 h-5" />
        </div>
        <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1 leading-none">{label}</p>
            <p className="text-xl font-bold tracking-tight leading-none">{value}</p>
        </div>
    </motion.div>
);

const StatusBadge = ({ status }: { status: ProcessStatus }) => {
    const { t } = useTranslation();
    switch (status) {
        case 'Done':
            return <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-wider text-green-400 bg-green-400/5 px-3 py-1 rounded-full border border-green-400/10"><CheckCircle2 className="w-3 h-3" /> {t('common.done')}</motion.span>;
        case 'Error':
            return <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-wider text-red-400 bg-red-400/5 px-3 py-1 rounded-full border border-red-400/10"><AlertCircle className="w-3 h-3" /> {t('common.error')}</motion.span>;
        case 'Processing':
            return <span className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-wider text-primary bg-primary/5 px-3 py-1 rounded-full border border-primary/10"><Loader2 className="w-3 h-3 animate-spin" /> {t('common.working')}</span>;
        default:
            return <span className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-wider text-text-muted bg-text-main/5 px-3 py-1 rounded-full border border-text-main/5"><Pause className="w-3 h-3" /> {t('common.pending')}</span>;
    }
}
