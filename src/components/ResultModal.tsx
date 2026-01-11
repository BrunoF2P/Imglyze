import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, FileText, X, TrendingDown, Clock, Layers } from 'lucide-react';
import { FileItem } from '../types';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { useResultStats } from '../hooks/useResultStats';

import { useBatch } from '../contexts/BatchContext';
import { ANIMATION_DELAYS, TYPOGRAPHY, LAYOUT } from '../lib/constants';

export const ResultModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
    isOpen,
    onClose
}) => {
    const {
        stats: rawStats,
        files,
        logs,
        handleCompare: onCompare
    } = useBatch();
    const successCount = files.filter(f => f.status === 'Done').length;
    const failedCount = files.filter(f => f.status === 'Error').length;

    const [view, setView] = useState<'summary' | 'logs' | 'files'>('summary');
    const stats = useResultStats(files, rawStats);

    if (!isOpen) return null;

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
                    className={cn("relative w-full max-w-xl overflow-hidden shadow-lg", LAYOUT.surface, LAYOUT.largeBorderRadius, "border border-text-main/10")}
                >
                    <button
                        onClick={onClose}
                        className="absolute top-6 right-6 p-2 rounded-full hover:bg-text-main/10 transition-colors z-10"
                    >
                        <X className="w-5 h-5 text-text-muted" />
                    </button>

                    <div className="p-8">
                        {view === 'summary' && (
                            <SummaryView
                                stats={stats}
                                rawStats={rawStats}
                                successCount={successCount}
                                failedCount={failedCount}
                            />
                        )}

                        {view === 'logs' && <LogsView logs={logs} />}

                        {view === 'files' && <FilesView files={files} onCompare={onCompare} />}

                        <ViewSwitcher view={view} setView={setView} onClose={onClose} />
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};


const SummaryView = ({ stats, rawStats, successCount, failedCount }: any) => {
    const { t } = useTranslation();
    return (
        <>
            <div className="flex flex-col items-center text-center mb-8">
                <motion.div
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.1, type: 'spring' }}
                    className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mb-4"
                >
                    <CheckCircle2 className="w-8 h-8 text-green-500" />
                </motion.div>
                <h2 className={cn(TYPOGRAPHY.heading, "mb-2 uppercase")}>{t('results.title')}</h2>
                <p className="text-text-muted text-sm font-medium tracking-tight">{t('results.subtitle')}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="space-y-3">
                    <ResultRow icon={Layers} label={t('results.processed')} value={`${rawStats.totalFiles} ${t('results.items')}`} />
                    <ResultRow icon={CheckCircle2} label={t('results.successful')} value={successCount} color="text-green-400" />
                    <ResultRow icon={XCircle} label={t('results.failed')} value={failedCount} color="text-red-400" />
                    <ResultRow icon={Clock} label={t('results.totalTime')} value={stats.formatTime(stats.totalTimeMs)} />
                </div>

                <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: ANIMATION_DELAYS.viewTransition }}
                    className={cn("flex flex-col justify-center items-center border border-text-main/5 relative overflow-hidden group", LAYOUT.glass, LAYOUT.borderRadius, LAYOUT.cardPadding)}
                >
                    <TrendingDown className="w-8 h-8 text-primary mb-2 relative z-10" />
                    <p className="text-4xl font-bold text-primary tracking-tight mb-0.5 relative z-10">-{stats.savedPercent}%</p>
                    <p className={cn(TYPOGRAPHY.compactLabel, "mb-1 relative z-10")}>{t('results.totalSaved')}</p>
                    <p className="text-lg font-bold text-text-main relative z-10">{(stats.totalSavedBytes / 1024 / 1024).toFixed(1)} MB</p>
                </motion.div>
            </div>
        </>
    );
};

const LogsView = ({ logs }: { logs: string[] }) => {
    const { t } = useTranslation();
    return (
        <div className="mb-8">
            <h3 className={cn(TYPOGRAPHY.subHeading, "mb-4 flex items-center gap-2")}>
                <FileText className="w-5 h-5 text-primary" />
                {t('results.processLog')}
            </h3>
            <LogViewer logs={logs} />
        </div>
    );
};

const FilesView = ({ files, onCompare }: { files: FileItem[]; onCompare: (f: FileItem) => void }) => {
    const { t } = useTranslation();
    return (
        <div className="mb-8">
            <h3 className={cn(TYPOGRAPHY.subHeading, "mb-4 flex items-center gap-2")}>
                <Layers className="w-5 h-5 text-primary" />
                {t('results.processedFiles')}
            </h3>
            <div className="bg-background/50 rounded-xl border border-text-main/5 overflow-hidden">
                <div className="h-[250px] overflow-y-auto custom-scrollbar p-2 space-y-1">
                    {files.filter(f => f.status === 'Done' || f.status === 'Error').map((file) => (
                        <div key={file.id} className="flex items-center justify-between p-3 rounded-lg bg-text-main/[0.02] border border-transparent hover:border-text-main/5 transition-all group">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="w-8 h-8 rounded bg-text-main/5 flex items-center justify-center text-[8px] font-black uppercase text-text-muted">{file.format}</div>
                                <div className="truncate">
                                    <p className="text-[10px] font-bold uppercase truncate">{file.name}</p>
                                    {file.status === 'Done' && (
                                        <p className="text-[9px] font-medium text-text-muted">
                                            {(file.size / 1024).toFixed(0)}KB → <span className="text-primary">{(file.optimizedSize ? file.optimizedSize / 1024 : 0).toFixed(0)}KB</span>
                                        </p>
                                    )}
                                </div>
                            </div>
                            {file.status === 'Done' ? (
                                <button
                                    onClick={() => onCompare(file)}
                                    className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-[9px] font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-all hover:bg-primary/20"
                                >
                                    {t('results.compare')}
                                </button>
                            ) : (
                                <XCircle className="w-4 h-4 text-red-400/50" />
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const ViewSwitcher = ({ view, setView, onClose }: any) => {
    const { t } = useTranslation();
    return (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <NavButton
                active={view === 'summary'}
                onClick={() => setView('summary')}
                icon={TrendingDown}
                label={t('results.summary')}
            />
            <NavButton
                active={view === 'files'}
                onClick={() => setView('files')}
                icon={Layers}
                label={t('results.files')}
            />
            <NavButton
                active={view === 'logs'}
                onClick={() => setView('logs')}
                icon={FileText}
                label={t('results.logs')}
            />
            <button onClick={onClose} className="p-3 bg-text-main/5 border border-text-main/5 rounded-xl font-bold uppercase tracking-wider text-[9px] text-text-main hover:bg-text-main/10 transition-all">
                {t('common.close')}
            </button>
        </div>
    );
};

const NavButton = ({ active, onClick, icon: Icon, label }: any) => (
    <button
        onClick={onClick}
        className={cn(
            "flex items-center justify-center gap-2 p-3 rounded-xl border font-bold uppercase tracking-wider text-[9px] transition-all",
            active ? "bg-primary/10 border-primary/20 text-primary" : "bg-text-main/5 border-text-main/5 text-text-muted hover:bg-text-main/10"
        )}
    >
        <Icon className="w-3.5 h-3.5" />
        {label}
    </button>
);

const ResultRow = ({ icon: Icon, label, value, color }: any) => (
    <div className="flex items-center justify-between">
        <span className={cn(TYPOGRAPHY.label, "flex items-center gap-2.5 normal-case")}>
            <Icon className={cn("w-3.5 h-3.5", color || "text-text-muted")} />
            {label}
        </span>
        <span className={cn("font-bold text-xs tracking-tight", color || "text-text-main")}>{value}</span>
    </div>
);

const LogViewer = ({ logs }: { logs: string[] }) => {
    const { t } = useTranslation();
    const scrollRef = React.useRef<HTMLDivElement>(null);
    React.useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    return (
        <div
            ref={scrollRef}
            className="bg-background/50 rounded-xl p-4 h-[250px] overflow-y-auto custom-scrollbar font-mono text-[10px] space-y-1 border border-text-main/5 select-text"
        >
            {logs.length > 0 ? logs.map((log, i) => (
                <div key={i} className="text-text-main/80 border-b border-text-main/5 pb-1 last:border-0">{log}</div>
            )) : (
                <div className="text-text-muted italic">{t('results.noLogs')}</div>
            )}
        </div>
    );
};
