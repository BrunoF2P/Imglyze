import { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { FileItem } from '../../../types';
import { formatBytes } from '../../../lib/utils';
import { FileListPanel } from './FileListPanel';
import { SettingsPanel } from '../../settings/components/SettingsPanel';
import { OutputOptionsPanel } from '../../settings/components/OutputOptionsPanel';
import { useBatch } from '../../../contexts/BatchContext';
import { useBatchStore } from '../../../stores/batchStore';

export function BatchAnalysis() {
    const { stats, settings, files, setFiles, setSettings, triggerOutputPathSelection, removeFile,
        updateAdvancedSetting, startProcessing, handleCompare, setComparingFile } = useBatch();
    const { t } = useTranslation();
    const [previewing, setPreviewing] = useState<string | null>(null);
    const previewRequest = useRef(0);
    useEffect(() => () => { previewRequest.current++; }, []);
    const preview = async (file: FileItem) => {
        const request = ++previewRequest.current;
        setPreviewing(file.id);
        setComparingFile({ ...file, optimizedPath: undefined, optimizedSize: undefined, fidelity: undefined, error: undefined, previewPending: true });
        try {
            const result = await invoke<FileItem>('preview_image', { item: file, settings });
            if (request === previewRequest.current && useBatchStore.getState().batch.files.some(item => item.id === file.id) && useBatchStore.getState().batch.comparingFile?.id === file.id) {
                setComparingFile(result);
            }
        }
        catch (error) {
            if (request === previewRequest.current && useBatchStore.getState().batch.comparingFile?.id === file.id) {
                setComparingFile({ ...file, optimizedPath: undefined, optimizedSize: undefined, fidelity: undefined, previewPending: false, error: String(error) });
                toast.error(t('v1.previewError'), { description: String(error) });
            }
        }
        finally { if (request === previewRequest.current) setPreviewing(null); }
    };
    const count = files.filter(f => f.selected).length;
    return <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
            <div><p className="eyebrow">{t('v1.workspace')}</p><h1 className="text-3xl font-semibold tracking-tight mt-2">{t('analysis.title')}</h1><p className="text-sm text-text-muted mt-2">{stats.totalFiles} {t('results.items')} · {formatBytes(stats.totalSize)} · {count} {t('v1.selected')}</p></div>
            <button className="btn-primary" disabled={!count || !!previewing || settings.outputMode === 'ZIP' && !settings.outputZipName} onClick={startProcessing}><Play size={16} />{t('analysis.startProcessing')}</button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-5 items-start">
            <FileListPanel files={files} onRemoveFile={removeFile} onSelectFile={id => setFiles(previous => previous.map(f => f.id === id ? { ...f, selected: !f.selected } : f))} onPreview={preview} onCompare={handleCompare} previewing={previewing} />
            <SettingsPanel settings={settings} onSettingsChange={setSettings} onAdvancedSettingUpdate={updateAdvancedSetting} output={<OutputOptionsPanel embedded settings={settings} onSettingsChange={setSettings} onSelectOutputPath={triggerOutputPathSelection} />} />
        </div>
    </div>;
}
