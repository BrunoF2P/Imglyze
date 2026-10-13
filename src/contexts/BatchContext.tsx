import React, { createContext, useContext, useEffect, useCallback, useMemo, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useTranslation } from 'react-i18next';
import { FileItem, BatchSettings, BatchStats, ImageFormat, AdvancedSettings } from '../types';
import { batchProcessingService } from '../features/batch-processing/services/BatchProcessingService';
import { settingsService } from '../features/settings/services/SettingsService';
import { statsCalculationService } from '../features/batch-processing/services/StatsCalculationService';

import { useBatchStore } from '../stores/batchStore';
import { toast } from 'sonner';
import { AppState } from '../actions/types';
import * as fileActions from '../actions/fileActions';
import * as settingsActions from '../actions/settingsActions';
import * as processingActions from '../actions/processingActions';

interface BatchContextType {
    state: AppState;
    files: FileItem[];
    settings: BatchSettings;
    stats: BatchStats;
    progress: number;
    isPaused: boolean;
    logs: string[];
    comparingFile: FileItem | null;

    setState: (state: AppState) => void;
    setFiles: React.Dispatch<React.SetStateAction<FileItem[]>>;
    setSettings: React.Dispatch<React.SetStateAction<BatchSettings>>;
    setComparingFile: (file: FileItem | null) => void;

    handleFilesSelected: (input: FileList | File[] | string[]) => Promise<void>;
    startProcessing: () => Promise<void>;
    triggerFileSelection: () => Promise<void>;
    triggerZipSelection: () => Promise<void>;
    triggerFolderSelection: () => Promise<void>;
    triggerOutputPathSelection: () => Promise<void>;
    togglePause: () => Promise<void>;
    cancelProcessing: () => Promise<void>;
    resetBatch: () => void;
    handleCompare: (file: FileItem) => void;
    removeFile: (id: string) => void;
    reorderFiles: (newFiles: FileItem[]) => void;
    sortFiles: (criteria: 'name' | 'size' | 'format') => void;
    updateAdvancedSetting: (format: ImageFormat, updates: Partial<AdvancedSettings>) => void;
}

const BatchContext = createContext<BatchContextType | null>(null);

export const BatchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { t } = useTranslation();

    const state = useBatchStore(s => s.batch);
    const dispatch = useBatchStore(s => s.dispatch);
    const [settingsLoaded, setSettingsLoaded] = useState(false);
    // Persistence: Load settings on mount
    useEffect(() => {
        const load = async () => {
            const saved = await settingsService.loadSettings();
            dispatch({ type: 'SET_SETTINGS', payload: saved });
            setSettingsLoaded(true); // ✅ Marca como carregado
        };
        load();
    }, []);

    useEffect(() => {
        if (!settingsLoaded) return; // ✅ Não salva antes de carregar

        const timeout = setTimeout(() => {
            settingsService.saveSettings(state.settings).catch(() => toast.error(t('v1.saveError')));
        }, 500);
        return () => clearTimeout(timeout);
    }, [state.settings, settingsLoaded]);

    // Derived stats
    const stats = useMemo<BatchStats>(() => {
        return statsCalculationService.calculateBatchStats(state.files, state.batchTiming);
    }, [state.files, state.batchTiming]);

    const progress = useMemo(() => {
        return statsCalculationService.calculateProgress(state.files);
    }, [state.files]);

    // Service subscriptions (Logs & Progress)
    useEffect(() => {
        const unlistenLogs = batchProcessingService.subscribeToLogs((log) => {
            dispatch({ type: 'ADD_LOG', payload: `[${new Date().toLocaleTimeString()}] ${log}` });
        });
        const updates = new Map<string, FileItem>();
        const flush = () => {
            if (updates.size) dispatch({ type: 'UPDATE_FILES', payload: [...updates.values()] });
            updates.clear();
        };
        const stopStatus = useBatchStore.subscribe((next, previous) => {
            if (next.batch.status !== previous.batch.status) flush();
        });
        const interval = setInterval(flush, 60);
        const unlistenProgress = batchProcessingService.subscribeToProgress(file => updates.set(file.id, file));

        return () => {
            clearInterval(interval);
            stopStatus();
            flush();
            unlistenLogs();
            unlistenProgress();
        };
    }, []);

    // Window title update
    useEffect(() => {
        const updateTitle = async () => {
            if (!("__TAURI_INTERNALS__" in window)) return;
            const win = getCurrentWindow();
            let title = t('windowTitle.idle');
            if (state.status === 'ANALYSIS') {
                title = t('windowTitle.analysis', { count: state.files.length });
            } else if (state.status === 'PROCESSING') {
                title = t('windowTitle.processing', { progress: Math.floor(progress) });
            } else if (state.status === 'COMPLETED') {
                title = t('windowTitle.completed');
            }
            try { await win.setTitle(title); } catch (err) { console.error(err); }
        };
        updateTitle();
    }, [state.status, progress, state.files.length, t]);

    // --- Action Wrappers ---

    const setState = useCallback((newStatus: AppState) => {
        dispatch({ type: 'SET_STATUS', payload: newStatus });
    }, []);

    // Compatibility wrappers for existing consumers using setFiles/setSettings
    const setFiles = useCallback((value: React.SetStateAction<FileItem[]>) => {
        const current = useBatchStore.getState().batch.files;
        dispatch({ type: 'SET_FILES', payload: typeof value === 'function' ? value(current) : value });
    }, [dispatch]);

    const setSettings = useCallback((value: React.SetStateAction<BatchSettings>) => {
        const current = useBatchStore.getState().batch.settings;
        dispatch({ type: 'SET_SETTINGS', payload: typeof value === 'function' ? value(current) : value });
    }, [dispatch]);

    const setComparingFile = useCallback((file: FileItem | null) => {
        dispatch({ type: 'SET_COMPARING_FILE', payload: file });
    }, []);

    // --- Business Logic Actions ---

    const handleFilesSelected = useCallback((input: FileList | File[] | string[]) => {
        if (useBatchStore.getState().batch.status === 'PROCESSING') return Promise.resolve();
        return fileActions.handleFilesSelected(dispatch, input);
    }, []);

    const startProcessing = useCallback(() => {
        const current = useBatchStore.getState().batch;
        if (current.status === 'PROCESSING') return Promise.resolve();
        return processingActions.startProcessing(dispatch, current.files, current.settings);
    }, [dispatch]);

    const triggerFileSelection = useCallback(() => {
        if (useBatchStore.getState().batch.status === 'PROCESSING') return Promise.resolve();
        return fileActions.triggerFileSelection(dispatch, t('common.selectImages'));
    }, [t]);

    const triggerZipSelection = useCallback(() => {
        if (useBatchStore.getState().batch.status === 'PROCESSING') return Promise.resolve();
        return fileActions.triggerZipSelection(dispatch, t('common.selectZip'));
    }, [t]);

    const triggerFolderSelection = useCallback(() => {
        if (useBatchStore.getState().batch.status === 'PROCESSING') return Promise.resolve();
        return fileActions.triggerFolderSelection(dispatch, t('common.selectFolder'));
    }, [t]);

    const triggerOutputPathSelection = useCallback(() => {
        return settingsActions.triggerOutputPathSelection(dispatch, t('analysis.selectDest'));
    }, [t]);

    const togglePause = useCallback(() => {
        return processingActions.togglePause(dispatch, state.isPaused);
    }, [state.isPaused]);

    const cancelProcessing = useCallback(() => {
        return processingActions.cancelProcessing(dispatch);
    }, []);

    const resetBatch = useCallback(() => {
        processingActions.resetBatch(dispatch, useBatchStore.getState().batch.settings);
    }, []);

    const handleCompare = useCallback((file: FileItem) => {
        dispatch({ type: 'SET_COMPARING_FILE', payload: file });
    }, []);

    const removeFile = useCallback((id: string) => {
        fileActions.removeFile(dispatch, id);
    }, []);

    const reorderFiles = useCallback((newFiles: FileItem[]) => {
        fileActions.reorderFiles(dispatch, newFiles);
    }, []);

    const sortFiles = useCallback((criteria: 'name' | 'size' | 'format') => {
        fileActions.sortFiles(dispatch, state.files, criteria);
    }, [state.files]);

    const updateAdvancedSetting = useCallback((format: ImageFormat, updates: Partial<AdvancedSettings>) => {
        settingsActions.updateAdvancedSetting(dispatch, format, updates);
    }, []);

    const value = useMemo(() => ({
        state: state.status,
        files: state.files,
        settings: state.settings,
        stats,
        progress,
        isPaused: state.isPaused,
        logs: state.logs,
        comparingFile: state.comparingFile,
        setState,
        setFiles,
        setSettings,
        setComparingFile,
        handleFilesSelected,
        startProcessing,
        triggerFileSelection,
        triggerZipSelection,
        triggerFolderSelection,
        triggerOutputPathSelection,
        togglePause,
        cancelProcessing,
        resetBatch,
        handleCompare,
        removeFile,
        reorderFiles,
        sortFiles,
        updateAdvancedSetting
    }), [
        state, stats, progress,
        setState, setFiles, setSettings, setComparingFile,
        handleFilesSelected, startProcessing, triggerFileSelection,
        triggerZipSelection, triggerFolderSelection, triggerOutputPathSelection,
        togglePause, cancelProcessing, resetBatch, handleCompare,
        removeFile, reorderFiles, sortFiles, updateAdvancedSetting
    ]);

    return (
        <BatchContext.Provider value={value}>
            {children}
        </BatchContext.Provider>
    );
};

export const useBatch = () => {
    const context = useContext(BatchContext);
    if (!context) throw new Error('useBatch must be used within a BatchProvider');
    return context;
};
