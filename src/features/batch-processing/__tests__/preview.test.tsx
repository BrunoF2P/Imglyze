import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { useBatchStore } from '../../../stores/batchStore';
import { FileItem } from '../../../types';

const compare = vi.hoisted(() => vi.fn());
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../../contexts/BatchContext', () => ({ useBatch: () => ({
    ...useBatchStore.getState().batch,
    stats: { totalFiles: 1, totalSize: 100 },
    setComparingFile: compare,
}) }));
vi.mock('../components/FileListPanel', () => ({ FileListPanel: ({ files, onPreview }: { files: FileItem[]; onPreview: (file: FileItem) => void }) => <button onClick={() => onPreview(files[0])}>preview</button> }));
vi.mock('../../settings/components/SettingsPanel', () => ({ SettingsPanel: () => null }));
vi.mock('../../settings/components/OutputOptionsPanel', () => ({ OutputOptionsPanel: () => null }));
import { BatchAnalysis } from '../components/BatchAnalysis';

const file: FileItem = { id: 'sample', name: 'sample.png', path: '/sample.png', format: 'PNG', size: 100, selected: true, status: 'Pending' };
beforeEach(() => {
    compare.mockReset();
    compare.mockImplementation((item: FileItem | null) => useBatchStore.setState(state => ({ batch: { ...state.batch, comparingFile: item } })));
    useBatchStore.setState(state => ({ batch: { ...state.batch, files: [file] } }));
});

it.each(['removed', 'unmounted'])('ignores a preview after its file is %s', async reason => {
    let resolve!: (item: FileItem) => void;
    vi.mocked(invoke).mockReturnValueOnce(new Promise<FileItem>(done => { resolve = done; }));
    const view = render(<BatchAnalysis />);
    fireEvent.click(screen.getByText('preview'));
    if (reason === 'unmounted') view.unmount();
    else useBatchStore.setState(state => ({ batch: { ...state.batch, files: [] } }));
    await act(async () => { resolve({ ...file, optimizedPath: '/preview.png' }); });
    expect(compare).toHaveBeenCalledTimes(1);
    expect(compare).toHaveBeenCalledWith(expect.objectContaining({ previewPending: true }));
});


it('opens immediately and replaces the loading state with the encoded preview', async () => {
    let resolve!: (item: FileItem) => void;
    vi.mocked(invoke).mockReturnValueOnce(new Promise<FileItem>(done => { resolve = done; }));
    render(<BatchAnalysis />);
    fireEvent.click(screen.getByText('preview'));
    expect(compare).toHaveBeenCalledWith(expect.objectContaining({ previewPending: true }));
    const result = { ...file, optimizedPath: '/preview.png', optimizedSize: 80 };
    await act(async () => { resolve(result); });
    expect(compare).toHaveBeenLastCalledWith(result);
});

it('does not reopen a preview the user closed during encoding', async () => {
    let resolve!: (item: FileItem) => void;
    vi.mocked(invoke).mockReturnValueOnce(new Promise<FileItem>(done => { resolve = done; }));
    render(<BatchAnalysis />);
    fireEvent.click(screen.getByText('preview'));
    useBatchStore.setState(state => ({ batch: { ...state.batch, comparingFile: null } }));
    await act(async () => { resolve({ ...file, optimizedPath: '/preview.png' }); });
    expect(compare).toHaveBeenCalledTimes(1);
});

it('clears the preparing state when encoding fails', async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error('Unreadable file'));
    render(<BatchAnalysis />);
    fireEvent.click(screen.getByText('preview'));
    await act(async () => {});
    expect(compare).toHaveBeenLastCalledWith(expect.objectContaining({ previewPending: false, error: 'Error: Unreadable file' }));
});
