import React from 'react';
import { Loader2, Clock, Pause, Play, XCircle } from 'lucide-react';
import { FileListPanel } from './FileListPanel';
import { cn } from '../../../lib/utils';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { useBatch } from '../../../contexts/BatchContext';
import { TYPOGRAPHY } from '../../../lib/constants';

export const ProcessingView: React.FC = () => {
    const {
        files,
        progress: overallProgress,
        stats,
        isPaused,
        togglePause: onPauseToggle,
        cancelProcessing: onCancel,
        handleCompare: onCompare
    } = useBatch();
    const { t } = useTranslation();
    const [now, setNow] = React.useState(Date.now());

    React.useEffect(() => {
        let interval: any;
        if (!isPaused) {
            interval = setInterval(() => {
                setNow(Date.now());
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isPaused]);

    const formatTime = (seconds: number) => {
        if (!isFinite(seconds) || seconds < 0) return "--:--";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const startTime = stats.startTime || now;
    const elapsedSeconds = (now - startTime) / 1000;
    const processedCount = files.filter(f => f.selected && (f.status === 'Done' || f.status === 'Error')).length;
    const totalSelected = files.filter(f => f.selected).length;

    return (
        <div className="w-full max-w-6xl mx-auto flex flex-col gap-6" >
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <h2 className={cn(TYPOGRAPHY.heading, "flex items-center gap-3")}>
                            {isPaused ? <Pause className="text-yellow-500 w-6 h-6" /> : <Loader2 className="animate-spin text-primary w-6 h-6" />}
                            {isPaused ? t('processing.paused') : t('processing.working')}
                        </h2>
                        <div className="h-8 w-px bg-text-main/10 hidden md:block" />
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-text-main/5 rounded-xl border border-text-main/5">
                            <Clock className="w-4 h-4 text-text-muted" />
                            <span className={TYPOGRAPHY.monoStats}>{formatTime(elapsedSeconds)}</span>
                        </div>
                    </div>
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

                <div>
                    <div className="w-full h-2 bg-text-main/10 rounded-full overflow-hidden" role="progressbar" aria-label={t('processing.working')} aria-valuenow={Math.round(overallProgress)} aria-valuemin={0} aria-valuemax={100}>
                        <motion.div className="h-full bg-primary" animate={{ width: `${overallProgress}%` }} />
                    </div>
                    <p className="text-sm text-text-muted mt-3">{processedCount} / {totalSelected} · {Math.round(overallProgress)}%</p>
                </div>
            </div>
            <FileListPanel files={files} onCompare={onCompare} />
        </div>
    );
};
