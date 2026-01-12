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

    dispatch({ type: 'SET_STATUS', payload: 'PROCESSING' });
    dispatch({ type: 'SET_PAUSED', payload: false });
    dispatch({ type: 'SET_TIMING', payload: { startTime: Date.now() } });

    try {
        await batchProcessingService.startBatch(files, settings);
        dispatch({ type: 'SET_TIMING', payload: { endTime: Date.now() } });
        dispatch({ type: 'SET_STATUS', payload: 'COMPLETED' });
    } catch (error) {
        console.error(error);
        const errorMsg = error instanceof Error ? error.message : String(error);
        await message(`Processing Failed: ${errorMsg}`, { title: 'Error', kind: 'error' });
        dispatch({ type: 'SET_STATUS', payload: 'ANALYSIS' });
    }
};

export const togglePause = async (
    dispatch: Dispatch<BatchAction>,
    isPaused: boolean
) => {
    const next = !isPaused;
    dispatch({ type: 'SET_PAUSED', payload: next });

    if (next) {
        await batchProcessingService.pauseBatch();
    } else {
        await batchProcessingService.resumeBatch();
    }
};

export const cancelProcessing = async (
    dispatch: Dispatch<BatchAction>,
    defaultSettings: BatchSettings
) => {
    await batchProcessingService.cancelBatch();
    dispatch({ type: 'RESET_BATCH', payload: defaultSettings });
};

export const resetBatch = (
    dispatch: Dispatch<BatchAction>,
    defaultSettings: BatchSettings
) => {
    dispatch({ type: 'RESET_BATCH', payload: defaultSettings });
};
