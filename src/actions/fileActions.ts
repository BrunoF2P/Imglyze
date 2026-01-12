import { Dispatch } from 'react';
import { BatchAction } from './types';
import { FileItem } from '../types';
import { fileDiscoveryService } from '../features/batch-processing/services/FileDiscoveryService';

export const handleFilesSelected = async (
    dispatch: Dispatch<BatchAction>,
    input: FileList | File[] | string[]
) => {
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
                dispatch({
                    type: 'ADD_LOG',
                    payload: `[${new Date().toLocaleTimeString()}] ERROR: ${err}`
                });
            });
        }
        if (result.items.length === 0) return;

        dispatch({ type: 'SET_FILES', payload: result.items });
        dispatch({ type: 'SET_STATUS', payload: 'ANALYSIS' });
    } catch (error) {
        console.error(error);
        dispatch({
            type: 'ADD_LOG',
            payload: `[${new Date().toLocaleTimeString()}] ERROR: File discovery failed`
        });
    }
};

export const triggerFileSelection = async (
    dispatch: Dispatch<BatchAction>,
    title: string
) => {
    try {
        const items = await fileDiscoveryService.selectImages(title);
        if (items.length > 0) {
            dispatch({ type: 'SET_FILES', payload: items });
            dispatch({ type: 'SET_STATUS', payload: 'ANALYSIS' });
        }
    } catch (error) {
        console.error('File selection error:', error);
    }
};

export const triggerZipSelection = async (
    dispatch: Dispatch<BatchAction>,
    title: string
) => {
    try {
        const items = await fileDiscoveryService.selectZip(title);
        if (items.length > 0) {
            dispatch({ type: 'SET_FILES', payload: items });
            dispatch({ type: 'SET_STATUS', payload: 'ANALYSIS' });
        }
    } catch (error) {
        console.error('ZIP selection error:', error);
    }
};

export const triggerFolderSelection = async (
    dispatch: Dispatch<BatchAction>,
    title: string
) => {
    try {
        const items = await fileDiscoveryService.selectFolder(title);
        if (items.length > 0) {
            dispatch({ type: 'SET_FILES', payload: items });
            dispatch({ type: 'SET_STATUS', payload: 'ANALYSIS' });
        }
    } catch (error) {
        console.error('Folder selection error:', error);
    }
};

export const removeFile = (dispatch: Dispatch<BatchAction>, id: string) => {
    dispatch({ type: 'REMOVE_FILE', payload: id });
};

export const reorderFiles = (dispatch: Dispatch<BatchAction>, newFiles: FileItem[]) => {
    dispatch({ type: 'REORDER_FILES', payload: newFiles });
};

export const sortFiles = (dispatch: Dispatch<BatchAction>, files: FileItem[], criteria: 'name' | 'size' | 'format') => {
    const sorted = [...files];
    sorted.sort((a, b) => {
        if (criteria === 'name') return a.name.localeCompare(b.name);
        if (criteria === 'size') return b.size - a.size;
        if (criteria === 'format') return a.format.localeCompare(b.format);
        return 0;
    });
    dispatch({ type: 'REORDER_FILES', payload: sorted });
};
