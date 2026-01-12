import { Dispatch } from 'react';
import { BatchAction } from './types';
import { BatchSettings, AdvancedSettings, ImageFormat } from '../types';

export const updateAdvancedSetting = (
    dispatch: Dispatch<BatchAction>,
    format: ImageFormat,
    updates: Partial<AdvancedSettings>
) => {
    dispatch({
        type: 'UPDATE_ADVANCED_SETTINGS',
        payload: { format: format as any as string, updates }
    });
};

export const triggerOutputPathSelection = async (
    dispatch: Dispatch<BatchAction>,
    title: string
) => {
    try {
        const { open } = await import('@tauri-apps/plugin-dialog');
        const selected = await open({
            directory: true,
            multiple: false,
            title: title,
        });
        if (selected && typeof selected === 'string') {
            dispatch({
                type: 'UPDATE_SETTINGS',
                payload: { outputPath: selected }
            });
        }
    } catch (error) {
        console.error(error);
    }
};

export const setSettings = (dispatch: Dispatch<BatchAction>, settings: BatchSettings) => {
    dispatch({ type: 'SET_SETTINGS', payload: settings });
};
