import { create } from 'zustand';
import { BatchAction, BatchState } from '../actions/types';
import { batchReducer } from '../reducers/batchReducer';
import { settingsService } from '../features/settings/services/SettingsService';

export const useBatchStore = create<{ batch: BatchState; dispatch: (action: BatchAction) => void }>((set) => ({
    batch: {
        status: 'IDLE', files: [], settings: settingsService.getDefaultSettings(),
        logs: [], isPaused: false, comparingFile: null, batchTiming: {},
    },
    dispatch: (action) => set(state => ({ batch: batchReducer(state.batch, action) })),
}));
