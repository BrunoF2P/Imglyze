import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../components/FileThumbnail', () => ({ FileThumbnail: () => null }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
import { FileListPanel } from '../components/FileListPanel';
import { FileItem } from '../../../types';

afterEach(() => vi.restoreAllMocks());
describe('large queues', () => {
    it('renders only a viewport of a 5,000-file batch', () => {
        vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(480);
        vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(600);
        const files: FileItem[] = Array.from({ length: 5000 }, (_, index) => ({ id: String(index), name: `photo-${index}.png`, path: `photo-${index}.png`, format: 'PNG', size: 100, selected: true, status: 'Pending' }));
        render(<FileListPanel files={files} />);
        expect(screen.getByText('5000 / 5000')).toBeTruthy();
        const rows = screen.getAllByRole('listitem');
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.length).toBeLessThan(25);
    });
});

it('reuses completed output when opening a comparison', () => {
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(480);
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(600);
    const onPreview = vi.fn();
    const onCompare = vi.fn();
    const file: FileItem = { id: 'done', name: 'photo.png', path: '/photo.png', optimizedPath: '/output.png', format: 'PNG', size: 100, selected: true, status: 'Done' };
    render(<FileListPanel files={[file]} onPreview={onPreview} onCompare={onCompare} />);
    fireEvent.click(screen.getByLabelText('v1.previewFile'));
    expect(onCompare).toHaveBeenCalledWith(file);
    expect(onPreview).not.toHaveBeenCalled();
});
