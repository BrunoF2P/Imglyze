import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { PreviewProvider } from '../../../contexts/PreviewContext';
import { FileThumbnail } from '../components/FileThumbnail';
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

beforeEach(() => vi.clearAllMocks());
it('replaces endless thumbnail loading with an explicit failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(invoke).mockRejectedValueOnce(new Error('Unreadable file'));
    render(<PreviewProvider><FileThumbnail id="photo" path="/photo.png" name="photo.png" /></PreviewProvider>);
    await waitFor(() => expect(screen.getByLabelText('v1.imageLoadError')).toBeTruthy());
    expect(screen.queryByLabelText('v1.loadingImages')).toBeNull();
    vi.restoreAllMocks();
});
it('ignores thumbnail failures from a removed file', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    let reject!: (error: Error) => void;
    vi.mocked(invoke).mockReturnValueOnce(new Promise((_resolve, fail) => { reject = fail; }));
    const view = render(<PreviewProvider><FileThumbnail id="photo" path="/photo.png" name="photo.png" /></PreviewProvider>);
    view.rerender(<PreviewProvider><span>Removed</span></PreviewProvider>);
    await act(async () => reject(new Error('Unreadable file')));
    expect(log).not.toHaveBeenCalled();
    vi.restoreAllMocks();
});
