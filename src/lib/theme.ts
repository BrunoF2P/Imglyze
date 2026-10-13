import { invoke } from '@tauri-apps/api/core';

export async function loadSystemTheme() {
    if (!("__TAURI_INTERNALS__" in window)) return;
    try {
        await invoke('get_system_theme');

        document.documentElement.style.colorScheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

    } catch (error) {
        console.error('Failed to load system theme, using fallback:', error);
    }
}
