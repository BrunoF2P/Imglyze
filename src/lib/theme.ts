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
    try {
        const theme = await invoke<SystemTheme>('get_system_theme');

        console.log('Loaded theme:', theme.name);

        const root = document.documentElement;

        // Aplicar cores
        root.style.setProperty('--sys-bg', theme.background);
        root.style.setProperty('--sys-fg', theme.foreground);
        root.style.setProperty('--sys-accent', theme.accent);
        root.style.setProperty('--sys-surface', theme.surface);
        root.style.setProperty('--sys-surface-variant', theme.surface_variant);
        root.style.setProperty('--sys-border', theme.border);

        // Define as bases para o CSS usar
        root.style.setProperty('--background', theme.background);
        root.style.setProperty('--text-main', theme.foreground);
        root.style.setProperty('--primary-color', theme.accent);
        root.style.setProperty('--surface', theme.surface);

        // Derivar outras cores
        applyDerivedColors(theme.foreground, theme.surface);

    } catch (error) {
        console.error('Failed to load system theme, using fallback:', error);
    }
}

function applyDerivedColors(fg: string, surface: string) {
    const root = document.documentElement;

    // Texto muted
    root.style.setProperty(
        '--text-muted',
        `color-mix(in srgb, ${fg}, transparent 45%)`
    );

    // Hover states
    root.style.setProperty(
        '--surface-hover',
        `color-mix(in srgb, ${surface} 90%, ${fg} 10%)`
    );

    // Glass effects
    root.style.setProperty(
        '--glass-background',
        `color-mix(in srgb, ${surface}, transparent 40%)`
    );

    root.style.setProperty(
        '--glass-border-color',
        `color-mix(in srgb, ${fg}, transparent 90%)`
    );
}
