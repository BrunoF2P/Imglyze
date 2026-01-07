import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, RotateCcw } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface HeaderProps {
    onSelectImages?: () => void;
    onSelectZip?: () => void;
    onSelectFolder?: () => void;
    onAbout?: () => void;
    onSupport?: () => void;
    showReset?: boolean;
    onReset?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
    onSelectImages,
    onSelectZip,
    onSelectFolder,
    onAbout,
    onSupport,
    showReset,
    onReset
}) => {
    const { t } = useTranslation();
    const [activeMenu, setActiveMenu] = useState<string | null>(null);

    const menuItems = [
        {
            id: 'file',
            label: t('menu.file'),
            subItems: [
                { label: t('common.selectImages'), onClick: onSelectImages },
                { label: t('common.selectZip'), onClick: onSelectZip },
                { label: t('common.selectFolder'), onClick: onSelectFolder },
            ]
        },
        {
            id: 'help',
            label: t('menu.help'),
            subItems: [
                { label: t('menu.support'), onClick: onSupport },
                { label: t('menu.about'), onClick: onAbout },
            ]
        },
    ];

    return (
        <div className="h-10 glass-dark flex-shrink-0 z-50 flex items-center justify-between px-4 select-none border-b border-text-main/5">
            <div className="flex items-center gap-2">
                {menuItems.map((item) => (
                    <div
                        key={item.id}
                        className="relative"
                    >
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (item.subItems) {
                                    setActiveMenu(activeMenu === item.id ? null : item.id);
                                } else {
                                    (item as any).onClick?.();
                                    setActiveMenu(null);
                                }
                            }}
                            className={cn(
                                "px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5",
                                activeMenu === item.id ? "bg-text-main/10 text-primary" : "text-text-muted hover:bg-text-main/5 hover:text-text-main"
                            )}
                        >
                            {item.label}
                            {item.subItems && <ChevronDown className="w-3 h-3 opacity-50" />}
                        </button>

                        {item.subItems && activeMenu === item.id && (
                            <>
                                <div
                                    className="fixed inset-0 z-40 outline-none"
                                    onClick={() => setActiveMenu(null)}
                                />
                                <div className="absolute top-full left-0 mt-1 w-48 glass-dark rounded-lg border border-text-main/10 shadow-xl overflow-hidden py-1 z-50">
                                    {item.subItems.map((subItem, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => {
                                                subItem.onClick?.();
                                                setActiveMenu(null);
                                            }}
                                            className="w-full text-left px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-text-muted hover:bg-primary hover:text-white transition-colors"
                                        >
                                            {subItem.label}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </div>

            <div className="flex items-center">
                <AnimatePresence>
                    {showReset && (
                        <motion.button
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            onClick={onReset}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider text-text-muted hover:text-primary hover:bg-text-main/5 transition-all"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            {t('common.resetApp')}
                        </motion.button>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};
