import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { FileItem } from '../../../types';

const osd = vi.hoisted(() => {
    const addTiledImage = vi.fn();
    const destroy = vi.fn();
    const viewer = {
        addTiledImage, destroy,
        addHandler: vi.fn(), setMouseNavEnabled: vi.fn(),
        world: { setItemIndex: vi.fn() },
        viewport: { goHome: vi.fn(), getZoom: () => 1, getHomeZoom: () => 1 },
    };
    return { addTiledImage, destroy, viewer, create: vi.fn(() => viewer) };
});
vi.mock('openseadragon', () => ({ default: Object.assign(osd.create, {
    Point: class { constructor(public x: number, public y: number) {} },
    Rect: class { constructor(public x: number, public y: number, public width: number, public height: number) {} },
}) }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(), convertFileSrc: (path: string) => path }));
vi.mock('react-i18next', () => { const t = (key: string) => key; return { useTranslation: () => ({ t }) }; });
import { CompareModal } from '../components/CompareModal';

const file: FileItem = { id: 'sample', name: 'sample.png', path: '/original.png', optimizedPath: '/optimized.png', size: 100, optimizedSize: 80, format: 'PNG', selected: true, status: 'Pending' };
beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(invoke).mockImplementation(async (_command, args) => (args as { path: string }).path);
});
const image = () => ({
    viewerElementToImageCoordinates: () => ({ x: 50 }),
    getContentSize: () => ({ x: 100, y: 100 }),
    setClip: vi.fn(), redraw: vi.fn(),
});

it('shows preparation immediately without loading a second copy of the original', () => {
    render(<CompareModal file={{ ...file, previewPending: true }} onClose={vi.fn()} />);
    expect(screen.getByRole('status').textContent).toBe('v1.generatingPreview');
    expect(osd.create).not.toHaveBeenCalled();
    expect(screen.queryByText('—%')).toBeNull();
});

it('normalizes resized outputs and clears loading after both images open', async () => {
    render(<CompareModal file={file} onClose={vi.fn()} />);
    await waitFor(() => expect(osd.addTiledImage).toHaveBeenCalledTimes(2));
    expect(osd.create).toHaveBeenCalledWith(expect.objectContaining({ crossOriginPolicy: 'Anonymous' }));
    expect(screen.getByText('20%')).toBeTruthy();
    const [left, right] = osd.addTiledImage.mock.calls.map(([options]) => options);
    expect(left.width).toBe(1);
    expect(right.width).toBe(1);
    await act(async () => { left.success({ item: image() }); right.success({ item: image() }); });
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
});

it('shows an image opening failure and retries with a new viewer', async () => {
    render(<CompareModal file={file} onClose={vi.fn()} />);
    await waitFor(() => expect(osd.addTiledImage).toHaveBeenCalledTimes(2));
    act(() => osd.addTiledImage.mock.calls[0][0].error());
    expect(screen.getByRole('alert').textContent).toBe('v1.previewError');
    fireEvent.click(screen.getByText('v1.retryPreview'));
    await waitFor(() => expect(osd.create).toHaveBeenCalledTimes(2));
    expect(osd.destroy).toHaveBeenCalledTimes(1);
});

it('reports preparation errors instead of leaving an empty viewer', async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error('Missing file'));
    render(<CompareModal file={file} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole('alert')).not.toBeNull());
    expect(screen.getByText('Error: Missing file')).not.toBeNull();
});

it('does not add images after the dialog is closed during preparation', async () => {
    let resolve!: (value: string) => void;
    vi.mocked(invoke).mockReturnValue(new Promise<string>(done => { resolve = done; }));
    const view = render(<CompareModal file={file} onClose={vi.fn()} />);
    view.unmount();
    await act(async () => { resolve('/prepared.png'); });
    expect(osd.addTiledImage).not.toHaveBeenCalled();
    expect(osd.destroy).toHaveBeenCalledTimes(1);
});

it('clears an earlier loading error when another preview is prepared', async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error('Missing file'));
    const view = render(<CompareModal file={file} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole('alert')).not.toBeNull());
    view.rerender(<CompareModal file={null} onClose={vi.fn()} />);
    view.rerender(<CompareModal file={{ ...file, previewPending: true }} onClose={vi.fn()} />);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('v1.generatingPreview');
});
