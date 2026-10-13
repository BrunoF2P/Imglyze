import { ReactNode, useEffect, useState } from 'react';
import { Bell, Save, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { requestPermission } from '@tauri-apps/plugin-notification';
import { AdvancedSettings, BatchSettings, ImageFormat } from '../../../types';
import { settingsService, PresetId } from '../services/SettingsService';
import { FormatPresetEditor } from './FormatPresetEditor';

interface SettingsPanelProps {
    output?: ReactNode;
    settings: BatchSettings;
    onSettingsChange: (settings: BatchSettings) => void;
    onAdvancedSettingUpdate: (format: ImageFormat, updates: Partial<AdvancedSettings>) => void;
}

export function SettingsPanel({ output, settings, onSettingsChange, onAdvancedSettingUpdate }: SettingsPanelProps) {
    const { t } = useTranslation();
    const [presets, setPresets] = useState<Record<string, BatchSettings>>({});
    const [name, setName] = useState('');
    const [selected, setSelected] = useState('');
    const [saving, setSaving] = useState(false);
    const [tab, setTab] = useState('general');
    const tabs = [
        ['general', t('v1.compressionTab')],
        ['formats', t('v1.formatsTab')],
        ['presets', t('v1.presetsTab')],
        ...(output ? [['output', t('v1.outputTab')]] : []),
    ];
    useEffect(() => { settingsService.loadPresets().then(setPresets).catch(() => toast.error(t('v1.saveError'))); }, [t]);
    const resize = settings.resize;
    const updateResize = (updates: Partial<typeof resize>) => onSettingsChange({ ...settings, resize: { ...resize, ...updates } });
    const save = async () => {
        setSaving(true);
        try {
            setPresets(await settingsService.savePreset(name, settings));
            setSelected(name.trim());
            setName('');
            toast.success(t('v1.presetSaved'));
        } catch { toast.error(t('v1.saveError')); }
        finally { setSaving(false); }
    };
    return <section className="panel space-y-4">
        <div><p className="eyebrow">{t('v1.recipe')}</p><h3 className="text-lg font-semibold mt-1">{t('analysis.settingsTitle')}</h3></div>
        <div className="settings-tabs" role="tablist" aria-label={t('analysis.settingsTitle')}>
            {tabs.map(([id, label]) => <button key={id} id={`settings-tab-${id}`} role="tab" tabIndex={tab === id ? 0 : -1} onKeyDown={event => {
                const index = tabs.findIndex(([key]) => key === id);
                const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1;
                if (next < 0) return;
                event.preventDefault();
                setTab(tabs[next][0]);
                document.getElementById(`settings-tab-${tabs[next][0]}`)?.focus();
            }} aria-selected={tab === id} aria-controls={`settings-panel-${id}`} onClick={() => setTab(id)}>{label}</button>)}
        </div>
        <div className="pt-4" role="tabpanel" id={`settings-panel-${tab}`} aria-labelledby={`settings-tab-${tab}`}>
        {tab === 'general' && <div className="space-y-4">
        <div className="flex gap-1 rounded-lg bg-background p-1">
            {[PresetId.BALANCED, PresetId.HIGH_QUALITY, PresetId.LOSSLESS].map(id => <button key={id}
                className={`flex-1 py-2 text-xs rounded-md ${settings.globalPreset === id ? 'bg-surface text-primary shadow-sm' : 'text-text-muted'}`}
                onClick={() => { setSelected(''); onSettingsChange({ ...settings, globalPreset: id, formatPresets: settingsService.applyPreset(id) }); }}>
                {t(id === PresetId.BALANCED ? 'analysis.presetBalanced' : id === PresetId.HIGH_QUALITY ? 'analysis.presetHigh' : 'analysis.presetLossless')}
            </button>)}
        </div>
        <p className="text-xs text-text-muted">{t('v1.losslessNote')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div className="settings-group space-y-3">
            <label htmlFor="resize-mode" className="field-label">{t('v1.resize')}</label>
            <select id="resize-mode" className="field w-full" value={resize.mode} onChange={e => updateResize({ mode: e.target.value as typeof resize.mode })}>
                <option value="Original">{t('v1.originalSize')}</option><option value="Fit">{t('v1.fit')}</option><option value="Percent">{t('v1.percent')}</option>
            </select>
            {resize.mode === 'Fit' && <div className="grid grid-cols-2 gap-3">{(['width', 'height'] as const).map(key => <label className="field-label" key={key}>{t(`v1.${key}`)}<input className="field w-full mt-2" type="number" min={1} max={32768} value={resize[key]} onChange={e => updateResize({ [key]: Number(e.target.value) })} /></label>)}</div>}
            {resize.mode === 'Percent' && <label className="field-label">{t('v1.scale')}<input className="field w-full mt-2" type="number" min={1} max={100} value={resize.percent} onChange={e => updateResize({ percent: Number(e.target.value) })} /></label>}
            {resize.mode !== 'Original' && <><p className="text-xs text-text-muted">{t('v1.aspectRatio')}</p><select className="field w-full" aria-label={t('v1.filter')} value={resize.filter} onChange={e => updateResize({ filter: e.target.value as typeof resize.filter })}><option>Lanczos3</option><option>CatmullRom</option></select></>}
        </div>
        <div className="settings-group space-y-4"><label className="flex gap-3 items-start text-sm"><input type="checkbox" className="mt-1" checked={settings.measureQuality} onChange={e => onSettingsChange({ ...settings, measureQuality: e.target.checked })} /><span>{t('v1.measureQuality')}<small className="block text-text-muted mt-1">{t('v1.metricNote')}</small></span></label>
        <button className="btn-secondary w-full" onClick={async () => {
            try { const permission = await requestPermission(); toast.info(t(permission === 'granted' ? 'v1.notificationsEnabled' : 'v1.notificationsDenied')); }
            catch { toast.error(t('v1.notificationsDenied')); }
        }}><Bell size={16} />{t('v1.enableNotifications')}</button>
        </div></div></div>}
        {tab === 'presets' && <div className="space-y-2">
            <label htmlFor="saved-preset" className="field-label">{t('v1.savedPresets')}</label>
            <div className="flex gap-2">
                <select id="saved-preset" className="field flex-1 min-w-0" value={selected} onChange={e => {
                    setSelected(e.target.value); setName(e.target.value);
                    if (presets[e.target.value]) onSettingsChange(structuredClone(presets[e.target.value]));
                }}><option value="">{t('v1.choosePreset')}</option>{Object.keys(presets).map(key => <option key={key}>{key}</option>)}</select>
                <button className="icon-button" aria-label={t('v1.deletePreset')} disabled={!selected || saving} onClick={async () => {
                    setSaving(true);
                    try { setPresets(await settingsService.deletePreset(selected)); setSelected(''); setName(''); }
                    catch { toast.error(t('v1.saveError')); }
                    finally { setSaving(false); }
                }}><Trash2 size={16} /></button>
            </div>
            <div className="flex gap-2"><input className="field flex-1 min-w-0" aria-label={t('v1.presetName')} placeholder={t('v1.presetName')} maxLength={80} value={name} onChange={e => setName(e.target.value)} />
                <button className="icon-button" aria-label={t('v1.savePreset')} disabled={!name.trim() || saving} onClick={save}><Save size={16} /></button></div>
        </div>}
        {tab === 'output' && output}
        {tab === 'formats' && <div className="space-y-4"><label className="flex gap-3 items-center text-sm"><input type="checkbox" checked={settings.advancedMode} onChange={e => onSettingsChange({ ...settings, advancedMode: e.target.checked })} />{t('analysis.advancedMode')}</label>
        {settings.advancedMode && <FormatPresetEditor settings={settings} onUpdate={onAdvancedSettingUpdate} />}
        </div>}
        </div>
    </section>;
}
