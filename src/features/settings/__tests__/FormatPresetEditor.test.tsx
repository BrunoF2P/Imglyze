import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { settingsService } from '../services/SettingsService';
import { FormatPresetEditor } from '../components/FormatPresetEditor';
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const batch = vi.hoisted(() => ({ stats: { formatBreakdown: { JPG: 2, PNG: 1 } as Record<string, number> } }));
vi.mock('../../../contexts/BatchContext', () => ({ useBatch: () => batch }));

it('shows one format at a time and edits the selected format only', () => {
    const settings = settingsService.getDefaultSettings();
    settings.formatPresets.PNG.quality = 92;
    const update = vi.fn();
    render(<FormatPresetEditor settings={settings} onUpdate={update} />);
    expect(screen.getAllByRole('slider')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'PNG 1' }));
    const slider = screen.getByLabelText('PNG — analysis.quality') as HTMLInputElement;
    expect(slider.value).toBe('92');
    fireEvent.change(slider, { target: { value: '85' } });
    expect(update).toHaveBeenCalledWith('PNG', { quality: 85 });
    fireEvent.click(screen.getByRole('button', { name: 'JPG 2' }));
    expect((screen.getByRole('slider') as HTMLInputElement).value).toBe('80');
});
it('falls back to an available format when the selected files change', () => {
    batch.stats.formatBreakdown = { JPG: 2, PNG: 1 };
    const settings = settingsService.getDefaultSettings();
    const view = render(<FormatPresetEditor settings={settings} onUpdate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'PNG 1' }));
    batch.stats.formatBreakdown = { JPG: 2, PNG: 0 };
    view.rerender(<FormatPresetEditor settings={settings} onUpdate={vi.fn()} />);
    expect(screen.getByLabelText('JPG — analysis.quality')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'PNG 1' })).toBeNull();
});
