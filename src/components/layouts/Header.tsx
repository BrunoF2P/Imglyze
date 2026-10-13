import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, RotateCcw } from 'lucide-react';
interface Props {
    onSelectImages?: () => void; onSelectZip?: () => void; onSelectFolder?: () => void;
    onAbout?: () => void; onSupport?: () => void; showReset?: boolean; onReset?: () => void;
}
export function Header(props: Props) {
    const { t } = useTranslation();
    const [menu, setMenu] = useState<string | null>(null);
    const ref = useRef<HTMLElement>(null);
    useEffect(() => {
        const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setMenu(null); };
        const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null); };
        document.addEventListener('mousedown', close); document.addEventListener('keydown', key);
        return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', key); };
    }, []);
    const menus = [{ id: 'file', label: t('menu.file'), entries: [[t('common.selectImages'), props.onSelectImages], [t('common.selectFolder'), props.onSelectFolder], [t('common.selectZip'), props.onSelectZip]] as const },
        { id: 'help', label: t('menu.help'), entries: [[t('menu.about'), props.onAbout], ...(props.onSupport ? [[t('menu.support'), props.onSupport] as const] : [])] as const }];
    return <header ref={ref} className="h-16 shrink-0 flex items-center justify-between px-6 border-b border-text-main/10 bg-surface z-50">
        <div className="flex items-center gap-7"><span className="flex items-center gap-3 text-lg font-semibold tracking-tight"><span className="brand-logo"><img src="/logo.png" alt="" /></span>Imglyze</span><nav className="flex gap-1">{menus.map(item => <div key={item.id} className="relative"><button className="menu-button" aria-expanded={menu === item.id} onClick={() => setMenu(menu === item.id ? null : item.id)}>{item.label}<ChevronDown size={13} /></button>{menu === item.id && <div className="menu-popover">{item.entries.map(([label, action]) => <button key={label} onClick={() => { action?.(); setMenu(null); }}>{label}</button>)}</div>}</div>)}</nav></div>
        {props.showReset && <button className="menu-button" onClick={props.onReset}><RotateCcw size={15} />{t('common.resetApp')}</button>}
    </header>;
}
