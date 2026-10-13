import { invoke } from '@tauri-apps/api/core';

interface SystemTheme {
    name: string;
    background: string;
    foreground: string;
    accent: string;
    surface: string;
    surface_variant: string;
    border: string;
}

export async function loadSystemTheme() {
    if (!("__TAURI_INTERNALS__" in window)) return;
    try {
        await invoke<SystemTheme>('get_system_theme');

        document.documentElement.style.colorScheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

    } catch (error) {
        console.error('Failed to load system theme, using fallback:', error);
    }
}
