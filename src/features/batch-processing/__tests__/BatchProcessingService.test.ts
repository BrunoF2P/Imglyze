import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }));
import { BatchProcessingService } from '../services/BatchProcessingService';
import { settingsService } from '../../settings/services/SettingsService';
describe('native batch lifecycle', () => {
    beforeEach(() => { vi.clearAllMocks(); vi.mocked(listen).mockResolvedValue(vi.fn()); });
    it('registers listeners before running and reuses them between batches', async () => {
        vi.mocked(invoke).mockResolvedValue({ cancelled: false, successes: 1, errors: 0 });
        const service = new BatchProcessingService();
        await service.startBatch([], settingsService.getDefaultSettings());
        await service.startBatch([], settingsService.getDefaultSettings());
        expect(listen).toHaveBeenCalledTimes(2);
        expect(vi.mocked(listen).mock.invocationCallOrder[1]).toBeLessThan(vi.mocked(invoke).mock.invocationCallOrder[0]);
        service.cleanup();
    });
    it('uses native running status when resuming, including after pause', async () => {
        const service = new BatchProcessingService();
        await service.pauseBatch(); await service.resumeBatch(); await service.cancelBatch();
        expect(vi.mocked(invoke).mock.calls).toEqual([
            ['set_processing_status', { status: 1 }], ['set_processing_status', { status: 0 }], ['set_processing_status', { status: 2 }]
        ]);
    });
    it('cancellation during listener setup prevents launching the batch', async () => {
        let release!: (unlisten: () => void) => void;
        vi.mocked(listen).mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
        const service = new BatchProcessingService();
        const running = service.startBatch([], settingsService.getDefaultSettings());
        await service.cancelBatch(); release(vi.fn());
        expect((await running).cancelled).toBe(true);
        expect(invoke).not.toHaveBeenCalledWith('run_batch', expect.anything());
        service.cleanup();
    });
    it('can retry after listener registration fails', async () => {
        vi.mocked(listen).mockRejectedValueOnce(new Error('listener failed'));
        const service = new BatchProcessingService();
        await expect(service.startBatch([], settingsService.getDefaultSettings())).rejects.toThrow('listener failed');
        await service.startBatch([], settingsService.getDefaultSettings());
        expect(invoke).toHaveBeenCalledWith('run_batch', expect.anything());
        service.cleanup();
    });
});
