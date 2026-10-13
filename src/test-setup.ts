import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Tauri API
vi.mock('@tauri-apps/api/window', () => ({
    getCurrentWindow: vi.fn(() => ({
        onThemeChanged: vi.fn(() => Promise.resolve(() => { })),
    })),
}));

vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
    open: vi.fn(),
    save: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-store', () => {
    const mockStoreInstance = {
        get: vi.fn(),
        set: vi.fn(),
        save: vi.fn(),
        init: vi.fn(),
        delete: vi.fn(),
        clear: vi.fn(),
        reset: vi.fn(),
        keys: vi.fn(),
        values: vi.fn(),
        entries: vi.fn(),
        length: vi.fn(),
        load: vi.fn(),
    };
    return {
        Store: vi.fn(function () { return mockStoreInstance; }),
        LazyStore: vi.fn(function () { return mockStoreInstance; }),
        load: vi.fn().mockResolvedValue(mockStoreInstance),
    };
});
