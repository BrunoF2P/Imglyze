import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, RotateCcw } from 'lucide-react';
import { cn } from '../../lib/utils';
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

    const headerRef = React.useRef<HTMLElement>(null);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
                setActiveMenu(null);
            }
        };

        if (activeMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [activeMenu]);

    return (
        <motion.header
            ref={headerRef}
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="h-14 flex-shrink-0 z-50 flex items-center justify-between px-6 select-none bg-gradient-to-b from-background/80 to-transparent backdrop-blur-[2px]"
        >
            <div className="flex items-center gap-2"> {/* Removed glass container, blending with bg */}
                {menuItems.map((item) => (
                    <div
                        key={item.id}
                        className="relative group"
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
                                "px-4 py-2 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 flex items-center gap-1.5",
                                activeMenu === item.id
                                    ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                                    : "text-text-muted hover:text-text-main hover:bg-surface/50"
                            )}
                        >
                            {item.label}
                            {item.subItems && (
                                <ChevronDown
                                    className={cn(
                                        "w-3.5 h-3.5 transition-transform duration-200",
                                        activeMenu === item.id ? "rotate-180 text-primary" : "opacity-50"
                                    )}
                                />
                            )}
                        </button>

                        <AnimatePresence>
                            {item.subItems && activeMenu === item.id && (
                                <motion.div
                                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                                    transition={{ duration: 0.2, type: "spring", stiffness: 300, damping: 25 }}
                                    className="absolute top-full left-0 mt-2 w-56 glass-dark rounded-2xl border border-white/5 shadow-2xl shadow-black/50 overflow-hidden py-2 z-50 backdrop-blur-2xl"
                                >
                                    {item.subItems.map((subItem, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => {
                                                subItem.onClick?.();
                                                setActiveMenu(null);
                                            }}
                                            className="relative w-[calc(100%-0.75rem)] mx-1.5 text-left px-3 py-2.5 text-xs font-medium text-text-muted transition-all duration-200 flex items-center gap-3 group/item hover:bg-white/5 rounded-xl overflow-hidden"
                                        >
                                            {/* Hover Highlight (Left Bar) */}
                                            <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary opacity-0 group-hover/item:opacity-100 transition-opacity duration-200" />

                                            {/* Glowing Dot */}
                                            <span className="w-1.5 h-1.5 rounded-full bg-white/10 group-hover/item:bg-primary group-hover/item:shadow-[0_0_8px_rgba(var(--sys-accent),0.8)] transition-all duration-300 group-hover/item:scale-110" />

                                            {/* Label with slide effect */}
                                            <span className="group-hover/item:text-white group-hover/item:translate-x-0.5 transition-all duration-200">
                                                {subItem.label}
                                            </span>
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                ))}
            </div>

            <div className="flex items-center">
                <AnimatePresence>
                    {showReset && (
                        <motion.button
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            onClick={onReset}
                            className="flex items-center gap-2 px-5 py-2 rounded-full text-xs font-semibold uppercase tracking-wider text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-all group ring-1 ring-transparent hover:ring-red-500/20"
                        >
                            <RotateCcw className="w-3.5 h-3.5 group-hover:-rotate-180 transition-transform duration-500" />
                            {t('common.resetApp')}
                        </motion.button>
                    )}
                </AnimatePresence>
            </div>
        </motion.header>
    );
};
