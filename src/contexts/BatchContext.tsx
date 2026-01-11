import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useTranslation } from 'react-i18next';
import { FileItem, BatchSettings, BatchStats, ImageFormat, AdvancedSettings } from '../types';
import { validateBatchSettings, validateFileSelection } from '../lib/validators';
import {
    fileDiscoveryService,
    batchProcessingService,
    settingsService,
    statsCalculationService
} from '../services';

type AppState = 'IDLE' | 'ANALYSIS' | 'PROCESSING' | 'COMPLETED';

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

    // Get default settings from service
    const getDefaultSettings = useCallback((): BatchSettings => {
        return settingsService.getDefaultSettings(t('analysis.presetBalanced'));
    }, [t]);

    const [state, setState] = useState<AppState>('IDLE');
    const [files, setFiles] = useState<FileItem[]>([]);
    const [settings, setSettings] = useState<BatchSettings>(getDefaultSettings());

    // Sync Advanced Settings when Global Preset changes
    useEffect(() => {
        if (settings.globalPreset !== 'Custom') {
            const newPresets = settingsService.applyPreset(settings.globalPreset);
            if (newPresets && JSON.stringify(settings.formatPresets) !== JSON.stringify(newPresets)) {
                setSettings(prev => ({ ...prev, formatPresets: newPresets }));
            }
        }
    }, [settings.globalPreset]);

    const [batchTiming, setBatchTiming] = useState<{ startTime?: number, endTime?: number }>({});
    const [logs, setLogs] = useState<string[]>([]);
    const [isPaused, setIsPaused] = useState(false);
    const [comparingFile, setComparingFile] = useState<FileItem | null>(null);

    // Calculate stats using service
    const stats = useMemo<BatchStats>(() => {
        return statsCalculationService.calculateBatchStats(files, batchTiming);
    }, [files, batchTiming]);

    // Calculate progress using service
    const progress = useMemo(() => {
        return statsCalculationService.calculateProgress(files);
    }, [files]);

    // Subscribe to event listeners using service
    useEffect(() => {
        const unlistenPromise = batchProcessingService.subscribeToLogs((log) => {
            setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${log}`]);
        });
        return () => { unlistenPromise.then(u => u()); };
    }, []);

    // File processed listener using service
    useEffect(() => {
        const unlistenPromise = batchProcessingService.subscribeToProgress((updatedFile) => {
            setFiles(prev => prev.map(f => f.id === updatedFile.id ? updatedFile : f));
        });
        return () => { unlistenPromise.then(u => u()); };
    }, []);

    // Window title update
    useEffect(() => {
        const updateTitle = async () => {
            const win = getCurrentWindow();
            let title = t('windowTitle.idle');
            if (state === 'ANALYSIS') {
                title = t('windowTitle.analysis', { count: files.length });
            } else if (state === 'PROCESSING') {
                title = t('windowTitle.processing', { progress: Math.floor(progress) });
            } else if (state === 'COMPLETED') {
                title = t('windowTitle.completed');
            }
            try { await win.setTitle(title); } catch (err) { console.error(err); }
        };
        updateTitle();
    }, [state, progress, files.length, t]);

    const handleFilesSelected = useCallback(async (input: FileList | File[] | string[]) => {
        let paths: string[] = [];
        if (Array.isArray(input)) {
            if (typeof input[0] === 'string') {
                paths = input as string[];
            } else {
                paths = (input as File[]).map(f => (f as any).path).filter(Boolean);
            }
        } else {
            paths = Array.from(input).map(f => (f as any).path).filter(Boolean);
        }

        if (paths.length === 0) return;

        try {
            const result = await fileDiscoveryService.discoverFiles(paths);
            if (result.errors.length > 0) {
                result.errors.forEach((err: string) => {
                    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ERROR: ${err}`]);
                });
            }
            if (result.items.length === 0) return;

            setFiles(result.items);
            setState('ANALYSIS');
        } catch (error) {
            console.error(error);
        }
    }, []);

    const startProcessing = useCallback(async () => {
        // Validation
        const settingsValidation = validateBatchSettings(settings);
        if (!settingsValidation.isValid) {
            const errorMsg = settingsValidation.error || 'Invalid settings.';
            setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ERROR: ${errorMsg}`]);
            return;
        }

        const filesValidation = validateFileSelection(files);
        if (!filesValidation.isValid) {
            const errorMsg = filesValidation.error || 'Invalid file selection.';
            setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ERROR: ${errorMsg}`]);
            return;
        }

        setState('PROCESSING');
        setIsPaused(false);
        setBatchTiming({ startTime: Date.now() });

        try {
            await batchProcessingService.startBatch(files, settings);
            setBatchTiming(prev => ({ ...prev, endTime: Date.now() }));
            setState('COMPLETED');
        } catch (error) {
            console.error(error);
            setState('ANALYSIS');
        }
    }, [files, settings]);

    const triggerFileSelection = useCallback(async () => {
        try {
            const items = await fileDiscoveryService.selectImages(t('common.selectFiles'));
            if (items.length > 0) {
                setFiles(items);
                setState('ANALYSIS');
            }
        } catch (error) {
            console.error('File selection error:', error);
        }
    }, [t]);

    const triggerZipSelection = useCallback(async () => {
        try {
            const items = await fileDiscoveryService.selectZip(t('common.selectZip'));
            if (items.length > 0) {
                setFiles(items);
                setState('ANALYSIS');
            }
        } catch (error) {
            console.error('ZIP selection error:', error);
        }
    }, [t]);

    const triggerFolderSelection = useCallback(async () => {
        try {
            const items = await fileDiscoveryService.selectFolder(t('common.selectFolder'));
            if (items.length > 0) {
                setFiles(items);
                setState('ANALYSIS');
            }
        } catch (error) {
            console.error('Folder selection error:', error);
        }
    }, [t]);

    const triggerOutputPathSelection = useCallback(async () => {
        const { open } = await import('@tauri-apps/plugin-dialog');
        const selected = await open({
            directory: true,
            multiple: false,
            title: t('analysis.selectDest'),
        });
        if (selected && typeof selected === 'string') {
            setSettings(prev => ({ ...prev, outputPath: selected }));
        }
    }, [t]);

    const togglePause = useCallback(async () => {
        const next = !isPaused;
        setIsPaused(next);
        if (next) {
            await batchProcessingService.pauseBatch();
        } else {
            await batchProcessingService.resumeBatch();
        }
    }, [isPaused]);

    const cancelProcessing = useCallback(async () => {
        await batchProcessingService.cancelBatch();
        setState('IDLE');
        setFiles([]);
        setLogs([]);
        setSettings(getDefaultSettings());
    }, [getDefaultSettings]);

    const resetBatch = useCallback(() => {
        setState('IDLE');
        setFiles([]);
        setLogs([]);
        setSettings(getDefaultSettings());
    }, [getDefaultSettings]);

    const updateAdvancedSetting = useCallback((format: ImageFormat, updates: Partial<AdvancedSettings>) => {
        setSettings(prev => {
            return settingsService.updateFormatSettings(prev, format, updates);
        });
    }, []);

    const handleCompare = useCallback((file: FileItem) => {
        setComparingFile(file);
    }, []);

    const removeFile = useCallback((id: string) => {
        setFiles(prev => prev.filter(f => f.id !== id));
    }, []);

    const reorderFiles = useCallback((newFiles: FileItem[]) => {
        setFiles(newFiles);
    }, []);

    const sortFiles = useCallback((criteria: 'name' | 'size' | 'format') => {
        setFiles(prev => {
            const sorted = [...prev];
            sorted.sort((a, b) => {
                if (criteria === 'name') return a.name.localeCompare(b.name);
                if (criteria === 'size') return b.size - a.size;
                if (criteria === 'format') return a.format.localeCompare(b.format);
                return 0;
            });
            return sorted;
        });
    }, []);

    const value = useMemo(() => ({
        state,
        files,
        settings,
        stats,
        progress,
        isPaused,
        logs,
        comparingFile,
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
        state, files, settings, stats, progress, isPaused, logs, comparingFile,
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
