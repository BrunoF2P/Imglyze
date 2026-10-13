import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LazyStore } from '@tauri-apps/plugin-store';
import { PresetId, settingsService } from '../services/SettingsService';
const store = new LazyStore('settings.json');
describe('persistent settings', () => {
    beforeEach(() => vi.clearAllMocks());
    it('migrates existing settings while preserving user choices', async () => {
        const old: any = settingsService.getDefaultSettings();
        delete old.resize; delete old.measureQuality; delete old.formatPresets.AVIF; delete old.formatPresets.SVG;
        old.globalPreset = 'High Quality (95)'; old.formatPresets.JPG.quality = 91;
        vi.mocked(store.get).mockResolvedValue(old);
        const loaded = await settingsService.loadSettings();
        expect(loaded.globalPreset).toBe(PresetId.HIGH_QUALITY);
        expect(loaded.formatPresets.JPG.quality).toBe(91);
        expect(loaded.formatPresets.AVIF).toBeDefined();
        expect(loaded.resize.mode).toBe('Original');
    });
    it('saves, replaces and deletes named presets without sharing mutable settings', async () => {
        vi.mocked(store.get).mockResolvedValue({});
        const settings = settingsService.getDefaultSettings();
        const presets = await settingsService.savePreset('  E-commerce  ', settings);
        settings.resize.width = 400;
        expect(presets['E-commerce'].resize.width).toBe(1920);
        expect(store.save).toHaveBeenCalled();
        vi.mocked(store.get).mockResolvedValue(presets);
        expect(await settingsService.deletePreset('E-commerce')).toEqual({});
    });
    it('rejects invalid settings and empty preset names', async () => {
        await expect(settingsService.savePreset(' ', settingsService.getDefaultSettings())).rejects.toThrow();
        const settings = settingsService.getDefaultSettings(); settings.resize.percent = 0;
        await expect(settingsService.saveSettings(settings)).rejects.toThrow();
        expect(store.set).not.toHaveBeenCalled();
    });
});
