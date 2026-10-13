import { toast } from 'sonner';
import i18n from '../i18n/config';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isPermissionGranted, sendNotification } from '@tauri-apps/plugin-notification';
import { Dispatch } from 'react';
import { message } from '@tauri-apps/plugin-dialog';
import { BatchAction } from './types';
import { BatchSettings, FileItem } from '../types';
import { validateFileSelection } from '../lib/validators';
import { validateSettings } from '../schemas/settingsSchema';
import { batchProcessingService } from '../features/batch-processing/services/BatchProcessingService';

export const startProcessing = async (
    dispatch: Dispatch<BatchAction>,
    files: FileItem[],
    settings: BatchSettings
) => {
    // Validation (Zod)
    const validationResult = validateSettings(settings);
    if (!validationResult.success) {
        // Detailed error formatting
        const errorMsg = validationResult.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        await message(`Invalid Settings: ${errorMsg}`, { title: 'Configuration Error', kind: 'error' });
        dispatch({
            type: 'ADD_LOG',
            payload: `[${new Date().toLocaleTimeString()}] INVALID SETTINGS: ${errorMsg}`
        });
        return;
    }

    const filesValidation = validateFileSelection(files);
    if (!filesValidation.isValid) {
        const errorMsg = filesValidation.error || 'Invalid file selection.';
        await message(errorMsg, { title: 'Selection Error', kind: 'error' });
        dispatch({
            type: 'ADD_LOG',
            payload: `[${new Date().toLocaleTimeString()}] ERROR: ${errorMsg}`
        });
        return;
    }

    dispatch({ type: 'SET_FILES', payload: files.map(file => file.selected ? { ...file, status: 'Pending', optimizedSize: undefined, optimizedPath: undefined, error: undefined, fidelity: undefined } : file) });
    dispatch({ type: 'SET_OUTPUT_PATH', payload: undefined });
    dispatch({ type: 'SET_STATUS', payload: 'PROCESSING' });
    dispatch({ type: 'SET_PAUSED', payload: false });
    dispatch({ type: 'SET_TIMING', payload: { startTime: Date.now() } });

    try {
        const outcome = await batchProcessingService.startBatch(files, settings);
        if (outcome.cancelled) {
            dispatch({ type: 'SET_STATUS', payload: 'ANALYSIS' });
            dispatch({ type: 'SET_PAUSED', payload: false });
            dispatch({ type: 'SET_TIMING', payload: { endTime: Date.now() } });
            toast.info(i18n.t('v1.batchCancelled'));
            return;
        }
        if (outcome.outputPath) dispatch({ type: 'SET_OUTPUT_PATH', payload: outcome.outputPath });
        (outcome.errors ? toast.warning : toast.success)(i18n.t('v1.batchSummary', { successes: outcome.successes, errors: outcome.errors }));
        try {
            if (await isPermissionGranted() && !await getCurrentWindow().isFocused()) sendNotification({ title: 'Imglyze', body: i18n.t('v1.batchSummary', { successes: outcome.successes, errors: outcome.errors }) });
        } catch { /* Completion remains available in the app. */ }
        dispatch({ type: 'SET_TIMING', payload: { endTime: Date.now() } });
        dispatch({ type: 'SET_STATUS', payload: 'COMPLETED' });
    } catch (error) {
        console.error(error);
        const errorMsg = error instanceof Error ? error.message : String(error);
        await message(`Processing Failed: ${errorMsg}`, { title: 'Error', kind: 'error' });
        dispatch({ type: 'SET_PAUSED', payload: false });
        dispatch({ type: 'SET_STATUS', payload: 'ANALYSIS' });
    }
};

export const togglePause = async (
    dispatch: Dispatch<BatchAction>,
    isPaused: boolean
) => {
    const next = !isPaused;
    if (next) {
        await batchProcessingService.pauseBatch();
    } else {
        await batchProcessingService.resumeBatch();
    }
    dispatch({ type: 'SET_PAUSED', payload: next });
};

export const cancelProcessing = async (
    dispatch: Dispatch<BatchAction>
) => {
    await batchProcessingService.cancelBatch();
    dispatch({ type: 'SET_PAUSED', payload: false });
};

export const resetBatch = (
    dispatch: Dispatch<BatchAction>,
    defaultSettings: BatchSettings
) => {
    dispatch({ type: 'RESET_BATCH', payload: defaultSettings });
};
