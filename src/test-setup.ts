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

vi.mock('@tauri-apps/plugin-store', () => ({
    Store: vi.fn(() => ({
        get: vi.fn(),
        set: vi.fn(),
        save: vi.fn(),
    })),
}));
