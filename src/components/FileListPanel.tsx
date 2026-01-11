import React from 'react';
import { FileCode, X, GripVertical, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { Reorder } from 'framer-motion';
import { cn } from '../lib/utils';
import { useTranslation } from 'react-i18next';
import { FileItem } from '../types';
import { ANIMATION_DELAYS, TYPOGRAPHY, LAYOUT } from '../lib/constants';
import { convertFileSrc } from '@tauri-apps/api/core';

interface FileListPanelProps {
    files: FileItem[];
    onRemoveFile: (id: string) => void;
    onReorderFiles: (files: FileItem[]) => void;
    onSortFiles: (criteria: 'name' | 'size' | 'format') => void;
    onHoverFile: (path: string | null) => void;
}

export const FileListPanel: React.FC<FileListPanelProps> = ({
    files,
    onRemoveFile,
    onReorderFiles,
    onSortFiles,
    onHoverFile
}) => {
    const { t } = useTranslation();

    return (
        <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: ANIMATION_DELAYS.viewTransition + 0.2 }}
            className={cn(LAYOUT.glass, LAYOUT.cardPadding, LAYOUT.largeBorderRadius, "h-fit")}
        >
            <div className="flex items-center justify-between mb-4">
                <h3 className={cn(TYPOGRAPHY.subHeading, "flex items-center gap-2")}>
                    <FileCode className="w-5 h-5 text-primary" />
                    {t('analysis.fileList')}
                </h3>

                {/* Sort Dropdown */}
                <div className="relative group">
                    <button className="flex items-center gap-1 text-[9px] font-bold text-text-muted hover:text-primary transition-colors uppercase tracking-wider">
                        {t('analysis.sort')}
                        <ChevronDown className="w-3 h-3" />
                    </button>

                    <div className="absolute right-0 top-full mt-2 w-32 bg-surface/95 backdrop-blur-xl border border-text-main/10 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                        <button
                            onClick={() => onSortFiles('name')}
                            className="w-full px-4 py-2 text-[10px] font-bold text-left hover:bg-primary/10 hover:text-primary transition-colors first:rounded-t-xl"
                        >
                            {t('analysis.sortName')}
                        </button>
                        <button
                            onClick={() => onSortFiles('size')}
                            className="w-full px-4 py-2 text-[10px] font-bold text-left hover:bg-primary/10 hover:text-primary transition-colors"
                        >
                            {t('analysis.sortSize')}
                        </button>
                        <button
                            onClick={() => onSortFiles('format')}
                            className="w-full px-4 py-2 text-[10px] font-bold text-left hover:bg-primary/10 hover:text-primary transition-colors last:rounded-b-xl"
                        >
                            {t('analysis.sortFormat')}
                        </button>
                    </div>
                </div>
            </div>

            {/* File List with Drag-and-Drop Reordering */}
            <Reorder.Group
                axis="y"
                values={files}
                onReorder={onReorderFiles}
                className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-2"
            >
                {files.map((file) => (
                    <Reorder.Item
                        key={file.id}
                        value={file}
                        className={cn(
                            "group bg-text-main/[0.02] border border-text-main/5 rounded-xl p-3 hover:border-primary/20 transition-all cursor-grab active:cursor-grabbing",
                            !file.selected && "opacity-40"
                        )}
                    >
                        <div className="flex items-center gap-3">
                            {/* Drag Handle */}
                            <GripVertical className="w-4 h-4 text-text-muted/30 group-hover:text-primary/50 flex-shrink-0" />

                            {/* File Thumbnail */}
                            <div
                                className="relative w-12 h-12 rounded-lg overflow-hidden bg-text-main/5 flex-shrink-0 ring-1 ring-text-main/5"
                                onMouseEnter={() => onHoverFile(file.path)}
                                onMouseLeave={() => onHoverFile(null)}
                            >
                                <img
                                    src={convertFileSrc(file.path)}
                                    alt={file.name}
                                    className="w-full h-full object-cover"
                                />
                            </div>

                            {/* File Info */}
                            <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-bold text-text-main truncate">
                                    {file.name}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[9px] font-bold text-text-muted">
                                        {(file.size / 1024).toFixed(1)} KB
                                    </span>
                                    <span className="w-1 h-1 rounded-full bg-text-muted/30" />
                                    <span className="text-[9px] font-bold text-primary">
                                        {file.format}
                                    </span>
                                </div>
                            </div>

                            {/* Remove Button */}
                            <button
                                onClick={() => onRemoveFile(file.id)}
                                className="w-6 h-6 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 flex items-center justify-center transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </Reorder.Item>
                ))}
            </Reorder.Group>
        </motion.section>
    );
};
