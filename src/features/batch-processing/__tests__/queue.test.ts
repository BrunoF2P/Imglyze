import { describe, expect, it, vi } from 'vitest';
vi.mock('../components/FileThumbnail', () => ({ FileThumbnail: () => null }));
import { filterAndSortFiles } from '../components/FileListPanel';
import { FileItem } from '../../../types';
const file = (name: string, size: number, optimizedSize: number, status: FileItem['status'] = 'Done'): FileItem => ({ id: name, name, path: name, format: 'PNG', size, optimizedSize, status, selected: true });
describe('queue search and sorting', () => {
    const files = [file('photo10.png', 1000, 700), file('photo2.png', 100, 10), file('pending.png', 9000, 0, 'Pending'), file('larger.png', 100, 200)];
    it('sorts naturally without mutating the queue', () => {
        expect(filterAndSortFiles(files, 'PHOTO', 'all', 'name').map(f => f.name)).toEqual(['photo2.png', 'photo10.png']);
        expect(files[0].name).toBe('photo10.png');
    });
    it('orders completed files by actual bytes and percentage saved', () => {
        expect(filterAndSortFiles(files, '', 'Done', 'savings').map(f => f.name)).toEqual(['photo10.png', 'photo2.png', 'larger.png']);
        expect(filterAndSortFiles(files, '', 'Done', 'percent')[0].name).toBe('photo2.png');
        expect(filterAndSortFiles(files, '', 'Pending', 'savings')).toHaveLength(1);
    });
});
