import { FileItem, BatchSettings, AdvancedSettings } from '../types';

export type AppState = 'IDLE' | 'ANALYSIS' | 'PROCESSING' | 'COMPLETED';

export interface BatchTiming {
    startTime?: number;
    endTime?: number;
}

export interface BatchState {
    status: AppState;
    files: FileItem[];
    settings: BatchSettings;
    logs: string[];
    isPaused: boolean;
    comparingFile: FileItem | null;
    batchTiming: BatchTiming;
}

export type BatchAction =
    | { type: 'SET_STATUS'; payload: AppState }
    | { type: 'SET_FILES'; payload: FileItem[] }
    | { type: 'ADD_FILES'; payload: FileItem[] }
    | { type: 'UPDATE_FILE'; payload: FileItem }
    | { type: 'REMOVE_FILE'; payload: string }
    | { type: 'SET_SETTINGS'; payload: BatchSettings }
    | { type: 'UPDATE_SETTINGS'; payload: Partial<BatchSettings> }
    | { type: 'UPDATE_ADVANCED_SETTINGS'; payload: { format: string; updates: Partial<AdvancedSettings> } }
    | { type: 'SET_COMPARING_FILE'; payload: FileItem | null }
    | { type: 'ADD_LOG'; payload: string }
    | { type: 'CLEAR_LOGS' }
    | { type: 'SET_PAUSED'; payload: boolean }
    | { type: 'SET_TIMING'; payload: BatchTiming }
    | { type: 'RESET_BATCH'; payload: BatchSettings } // Payload is default settings
    | { type: 'REORDER_FILES'; payload: FileItem[] };
