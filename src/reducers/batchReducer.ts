import { BatchState, BatchAction } from '../actions/types';
import { PresetId, settingsService } from '../features/settings/services/SettingsService';

export const batchReducer = (state: BatchState, action: BatchAction): BatchState => {
    switch (action.type) {
        case 'SET_STATUS':
            return { ...state, status: action.payload };

        case 'SET_FILES':
            return { ...state, files: action.payload };

        case 'ADD_FILES':
            return { ...state, files: [...state.files, ...action.payload] };

        case 'UPDATE_FILE':
            return {
                ...state,
                files: state.files.map(f => f.id === action.payload.id ? action.payload : f)
            };

        case 'REMOVE_FILE':
            return {
                ...state,
                files: state.files.filter(f => f.id !== action.payload)
            };

        case 'REORDER_FILES':
            return { ...state, files: action.payload };

        case 'SET_SETTINGS':
            return { ...state, settings: action.payload };

        case 'UPDATE_SETTINGS':
            const updatedSettings = { ...state.settings, ...action.payload };

            // Auto-sync logic (sync presets if global preset changes)
            if (
                action.payload.globalPreset &&
                action.payload.globalPreset !== PresetId.CUSTOM
            ) {
                const newPresets = settingsService.applyPreset(action.payload.globalPreset);
                updatedSettings.formatPresets = newPresets;
            }

            return { ...state, settings: updatedSettings };

        case 'UPDATE_ADVANCED_SETTINGS':
            const { format, updates } = action.payload;
            // Assuming we have access to settingsService logic or reproduce it here.
            // But since settingsService is imported, we can reuse it helper or just do it inline if simple.
            // The original code used `settingsService.updateFormatSettings`.
            const newSettings = settingsService.updateFormatSettings(
                state.settings,
                format as any,
                updates
            );
            return { ...state, settings: newSettings };

        case 'SET_COMPARING_FILE':
            return { ...state, comparingFile: action.payload };

        case 'ADD_LOG':
            return { ...state, logs: [...state.logs, action.payload] };

        case 'CLEAR_LOGS':
            return { ...state, logs: [] };

        case 'SET_PAUSED':
            return { ...state, isPaused: action.payload };

        case 'SET_TIMING':
            return { ...state, batchTiming: { ...state.batchTiming, ...action.payload } };

        case 'RESET_BATCH':
            return {
                ...state,
                status: 'IDLE',
                files: [],
                logs: [],
                comparingFile: null,
                isPaused: false,
                batchTiming: {},
                settings: action.payload // Reset to defaults provided in payload
            };

        default:
            return state;
    }
};
