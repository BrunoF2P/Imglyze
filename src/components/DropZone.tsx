import React, { useState } from 'react';
import { Upload, FileArchive, Folder, MousePointer2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

interface DropZoneProps {
    onFilesSelected: (files: FileList | File[]) => void;
    onSelectImages: () => void;
    onSelectZip: () => void;
    onSelectFolder: () => void;
}

export const DropZone: React.FC<DropZoneProps> = ({
    onFilesSelected,
    onSelectImages,
    onSelectZip,
    onSelectFolder
}) => {
    const { t } = useTranslation();
    const [isDragActive, setIsDragActive] = useState(false);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragActive(true);
    };

    const handleDragLeave = () => {
        setIsDragActive(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            onFilesSelected(e.dataTransfer.files);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto gap-8">
            <motion.div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                animate={{
                    scale: isDragActive ? 1.01 : 1,
                    borderColor: isDragActive ? 'var(--primary-color)' : 'var(--glass-border-color)',
                    backgroundColor: isDragActive ? 'color-mix(in srgb, var(--primary-color) 5%, transparent)' : 'var(--glass-background)'
                }}
                className={cn(
                    "w-full flex-1 min-h-[300px] glass flex flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all duration-300 gap-4 cursor-pointer relative overflow-hidden group",
                    isDragActive && "shadow-lg shadow-primary/5"
                )}
                onClick={onSelectImages}
            >
                <motion.div
                    animate={{
                        y: isDragActive ? -5 : 0,
                    }}
                    className={cn(
                        "p-6 rounded-full glass border border-text-main/10 relative z-10",
                    )}
                >
                    <Upload className="w-12 h-12 text-primary relative z-10" />
                </motion.div>

                <div className="text-center relative z-10">
                    <h2 className="text-2xl font-bold mb-2 tracking-tight">{t('common.dragAndDrop')}</h2>
                    <p className="text-sm text-text-muted font-medium">{t('common.supports')}</p>
                </div>

                {/* Shimmer effect when dragging */}
                {isDragActive && <div className="absolute inset-0 shimmer-bg pointer-events-none opacity-10" />}
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                <QuickAction
                    icon={MousePointer2}
                    label={t('common.selectImages')}
                    onClick={onSelectImages}
                    color="primary"
                />

                <QuickAction
                    icon={FileArchive}
                    label={t('common.selectZip')}
                    onClick={onSelectZip}
                    color="accent"
                />

                <QuickAction
                    icon={Folder}
                    label={t('common.selectFolder')}
                    onClick={onSelectFolder}
                    color="secondary"
                />
            </div>
        </div>
    );
};

const QuickAction = ({ icon: Icon, label, onClick, color, children }: any) => {
    const colorClasses: any = {
        primary: "text-primary hover:bg-primary/5 border-primary/10",
        accent: "text-accent hover:bg-accent/5 border-accent/10",
        secondary: "text-secondary hover:bg-secondary/5 border-secondary/10"
    };

    return (
        <motion.button
            whileHover={{ y: -2, scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
            className={cn(
                "glass p-5 rounded-xl flex flex-col items-center gap-3 transition-all border",
                colorClasses[color]
            )}
        >
            <div className="p-3 rounded-lg bg-current opacity-5 absolute inset-0 pointer-events-none" />
            <Icon className="w-6 h-6 relative z-10" />
            <span className="font-bold text-sm tracking-tight relative z-10">{label}</span>
            {children}
        </motion.button>
    );
};
