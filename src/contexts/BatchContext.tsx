import React, { createContext, useContext, useEffect, useCallback, useMemo, useReducer, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useTranslation } from 'react-i18next';
import { FileItem, BatchSettings, BatchStats, ImageFormat, AdvancedSettings } from '../types';
import { batchProcessingService } from '../features/batch-processing/services/BatchProcessingService';
import { settingsService } from '../features/settings/services/SettingsService';
import { statsCalculationService } from '../features/batch-processing/services/StatsCalculationService';

import { batchReducer } from '../reducers/batchReducer';
import { AppState, BatchState } from '../actions/types';
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

    // Get default settings
    const getDefaultSettings = useCallback((): BatchSettings => {
        return settingsService.getDefaultSettings();
    }, []);

    const initialState: BatchState = {
        status: 'IDLE',
        files: [],
        settings: getDefaultSettings(),
        logs: [],
        isPaused: false,
        comparingFile: null,
        batchTiming: {}
    };

    const [state, dispatch] = useReducer(batchReducer, initialState);
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
            settingsService.saveSettings(state.settings);
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
        const unlistenProgress = batchProcessingService.subscribeToProgress((updatedFile) => {
            dispatch({ type: 'UPDATE_FILE', payload: updatedFile });
        });

        return () => {
            unlistenLogs();
            unlistenProgress();
        };
    }, []);

    // Window title update
    useEffect(() => {
        const updateTitle = async () => {
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
        // Handle functional update or direct value
        if (typeof value === 'function') {
            // This is tricky with reducer, but we can access current state in reducer.
            // For now, simple implementation assuming we have access to current files if needed,
            // but useReducer dispatch doesn't give us current state in the action payload easily for func updates.
            // However, most calls are likely direct sets or simple filters.
            // We'll simplify: strictly allow direct arrays or basic updates.
            // Ideally refactor consumers to not use setFiles(prev => ...).
            console.warn("setFiles functional update not fully supported in refactor yet, using direct dispatch if possible");
            // Since we can't easily execute the generic SetStateAction function without the state here...
            // We will assume for this refactor consumers use the actions provided below (removeFile etc).
            // If legacy code uses setFiles, we might need a workaround or just pass the current files manually?
            // Actually, we can just cheat and use state.files:
            const newFiles = typeof value === 'function' ? (value as any)(state.files) : value;
            dispatch({ type: 'SET_FILES', payload: newFiles });
        } else {
            dispatch({ type: 'SET_FILES', payload: value });
        }
    }, [state.files]);

    const setSettings = useCallback((value: React.SetStateAction<BatchSettings>) => {
        if (typeof value === 'function') {
            const newSettings = (value as any)(state.settings);
            dispatch({ type: 'SET_SETTINGS', payload: newSettings });
        } else {
            dispatch({ type: 'SET_SETTINGS', payload: value });
        }
    }, [state.settings]);

    const setComparingFile = useCallback((file: FileItem | null) => {
        dispatch({ type: 'SET_COMPARING_FILE', payload: file });
    }, []);

    // --- Business Logic Actions ---

    const handleFilesSelected = useCallback((input: FileList | File[] | string[]) => {
        return fileActions.handleFilesSelected(dispatch, input);
    }, []);

    const startProcessing = useCallback(() => {
        return processingActions.startProcessing(dispatch, state.files, state.settings);
    }, [state.files, state.settings]);

    const triggerFileSelection = useCallback(() => {
        return fileActions.triggerFileSelection(dispatch, t('common.selectFiles'));
    }, [t]);

    const triggerZipSelection = useCallback(() => {
        return fileActions.triggerZipSelection(dispatch, t('common.selectZip'));
    }, [t]);

    const triggerFolderSelection = useCallback(() => {
        return fileActions.triggerFolderSelection(dispatch, t('common.selectFolder'));
    }, [t]);

    const triggerOutputPathSelection = useCallback(() => {
        return settingsActions.triggerOutputPathSelection(dispatch, t('analysis.selectDest'));
    }, [t]);

    const togglePause = useCallback(() => {
        return processingActions.togglePause(dispatch, state.isPaused);
    }, [state.isPaused]);

    const cancelProcessing = useCallback(() => {
        return processingActions.cancelProcessing(dispatch, getDefaultSettings());
    }, [getDefaultSettings]);

    const resetBatch = useCallback(() => {
        processingActions.resetBatch(dispatch, getDefaultSettings());
    }, [getDefaultSettings]);

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
