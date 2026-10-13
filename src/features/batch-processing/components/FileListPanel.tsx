import { useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Eye, Loader2, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FileItem } from '../../../types';
import { formatBytes } from '../../../lib/utils';
import { FileThumbnail } from './FileThumbnail';

export type QueueSort = 'name' | 'size' | 'savings' | 'percent';
export function filterAndSortFiles(files: FileItem[], query: string, status: string, sort: QueueSort) {
    const filtered = files.filter(f => (f.relativePath ?? f.name).toLocaleLowerCase().includes(query.toLocaleLowerCase()) && (status === 'all' || f.status === status));
    const savings = (f: FileItem) => f.status === 'Done' ? f.size - (f.optimizedSize ?? f.size) : 0;
    return filtered.sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name, undefined, { numeric: true })
        : sort === 'size' ? b.size - a.size : sort === 'savings' ? savings(b) - savings(a)
        : savings(b) / (b.size || 1) - savings(a) / (a.size || 1));
}
interface Props {
    files: FileItem[];
    onRemoveFile?: (id: string) => void;
    onSelectFile?: (id: string) => void;
    onPreview?: (file: FileItem) => void;
    onCompare?: (file: FileItem) => void;
    previewing?: string | null;
}
export function FileListPanel({ files, onRemoveFile, onSelectFile, onPreview, onCompare, previewing }: Props) {
    const { t } = useTranslation();
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState('all');
    const [sort, setSort] = useState<QueueSort>('name');
    const scroll = useRef<HTMLDivElement>(null);
    const visible = useMemo(() => filterAndSortFiles(files, query, status, sort), [files, query, status, sort]);
    const virtual = useVirtualizer({ count: visible.length, getScrollElement: () => scroll.current, estimateSize: () => 80, overscan: 5, initialRect: { width: 600, height: 480 }, getItemKey: index => visible[index].id });
    return <section className="panel queue-panel">
        <div className="flex items-center justify-between mb-5"><div><p className="eyebrow">{t('v1.workspace')}</p><h3 className="text-lg font-semibold mt-1">{t('analysis.fileList')} <span className="text-text-muted font-normal text-sm">{visible.length} / {files.length}</span></h3></div></div>
        <div className="flex flex-wrap gap-2 mb-5">
            <label className="relative flex-1 min-w-40"><Search size={16} className="absolute left-3 top-3 text-text-muted" /><input className="field w-full pl-9" aria-label={t('v1.search')} placeholder={t('v1.search')} value={query} onChange={e => setQuery(e.target.value)} /></label>
            <select className="field" aria-label={t('v1.status')} value={status} onChange={e => setStatus(e.target.value)}><option value="all">{t('v1.allStatuses')}</option>{['Pending', 'Processing', 'Done', 'Error'].map(s => <option key={s} value={s}>{t(`v1.status${s}`)}</option>)}</select>
            <select className="field" aria-label={t('analysis.sort')} value={sort} onChange={e => setSort(e.target.value as QueueSort)}>{(['name', 'size', 'savings', 'percent'] as const).map(s => <option key={s} value={s}>{t(`v1.sort${s}`)}</option>)}</select>
        </div>
        <div ref={scroll} className="queue-scroll custom-scrollbar" role="list" aria-label={t('analysis.fileList')}>
            {!visible.length && <p className="text-sm text-text-muted py-12 text-center">{t('v1.noMatches')}</p>}
            <div style={{ height: virtual.getTotalSize(), position: 'relative' }}>
                {virtual.getVirtualItems().map(row => {
                    const file = visible[row.index];
                    return <div role="listitem" key={file.id} className="queue-row" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: row.size, transform: `translateY(${row.start}px)` }}>
                        {onSelectFile && <input type="checkbox" aria-label={t('v1.selectFile', { name: file.name })} checked={file.selected} onChange={() => onSelectFile(file.id)} />}
                        <FileThumbnail id={file.id} path={file.path} name={file.name} className="w-11 h-11 rounded-md overflow-hidden shrink-0" />
                        <div className="min-w-0 flex-1"><p className="text-sm font-medium truncate" title={file.relativePath ?? file.name}>{file.relativePath ?? file.name}</p><p className="text-xs text-text-muted mt-1">{file.format} · {formatBytes(file.size, 1)}{file.optimizedSize != null && ` → ${formatBytes(file.optimizedSize, 1)}`} {file.fidelity != null && ` · SSIM ${file.fidelity.toFixed(1)}%`}</p>{file.error && <p className="text-xs text-red-500 truncate" title={file.error}>{file.error}</p>}</div>
                        <span className={`text-xs ${file.status === 'Error' ? 'text-red-500' : 'text-text-muted'}`}>{t(`v1.status${file.status}`)}</span>
                        {(onPreview || onCompare && file.status === 'Done') && <button className="icon-button" disabled={!!previewing} aria-label={t('v1.previewFile', { name: file.name })} onClick={() => file.status === 'Done' && file.optimizedPath && onCompare ? onCompare(file) : onPreview?.(file)}>{previewing === file.id ? <Loader2 size={17} className="animate-spin" /> : <Eye size={17} />}</button>}
                        {onRemoveFile && <button className="icon-button" aria-label={t('v1.removeFile', { name: file.name })} onClick={() => onRemoveFile(file.id)}><X size={16} /></button>}
                    </div>;
                })}
            </div>
        </div>
    </section>;
}
