import { useState, DragEvent } from 'react';
import { ArrowUpRight, FileArchive, Folder, ImagePlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
interface Props {
    onFilesSelected: (files: FileList | File[]) => void;
    onSelectImages: () => void;
    onSelectZip: () => void;
    onSelectFolder: () => void;
}
export function DropZone({ onFilesSelected, onSelectImages, onSelectZip, onSelectFolder }: Props) {
    const { t } = useTranslation();
    const [dragging, setDragging] = useState(false);
    const drop = (event: DragEvent) => { event.preventDefault(); setDragging(false); if (event.dataTransfer.files.length) onFilesSelected(event.dataTransfer.files); };
    return <div className="max-w-4xl mx-auto w-full">
        <p className="eyebrow mb-5">{t('v1.local')}</p>
        <h1 className="text-4xl md:text-5xl tracking-tight font-semibold max-w-2xl leading-[1.12]">{t('v1.intro')}</h1>
        <p className="text-text-muted text-base max-w-xl mt-5 mb-10 leading-relaxed">{t('v1.introDetail')}</p>
        <button onClick={onSelectImages} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop} className={`drop-target w-full text-left ${dragging ? 'dragging' : ''}`}>
            <div className="flex items-center gap-5"><ImagePlus size={36} strokeWidth={1.3} className="text-primary" /><div className="flex-1"><h2 className="text-lg font-medium">{t('common.dragAndDrop')}</h2><p className="text-sm text-text-muted mt-2">{t('common.supports')}</p></div><ArrowUpRight size={22} className="text-text-muted" /></div>
        </button>
        <div className="flex flex-wrap gap-3 mt-4"><button className="btn-primary" onClick={onSelectImages}><ImagePlus size={17} />{t('common.selectImages')}</button><button className="btn-secondary" onClick={onSelectFolder}><Folder size={17} />{t('common.selectFolder')}</button><button className="btn-secondary" onClick={onSelectZip}><FileArchive size={17} />{t('common.selectZip')}</button></div>
    </div>;
}
