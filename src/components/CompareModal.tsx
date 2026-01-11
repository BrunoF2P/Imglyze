import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Info, ChevronLeft, ChevronRight, Maximize2, Minimize2, RotateCcw } from 'lucide-react';
import { FileItem } from '../types';
import { convertFileSrc } from '@tauri-apps/api/core';
import { cn } from '../lib/utils';
import { InfoStat } from './InfoStat';
import { useTranslation } from 'react-i18next';

interface CompareModalProps {
    file: FileItem | null;
    onClose: () => void;
}

export const CompareModal: React.FC<CompareModalProps> = ({ file, onClose }) => {
    const { t } = useTranslation();
    const [sliderPos, setSliderPos] = useState(50);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [startDrag, setStartDrag] = useState({ x: 0, y: 0 });

    const containerRef = useRef<HTMLDivElement>(null);

    // Reset view when file changes
    useEffect(() => {
        setScale(1);
        setOffset({ x: 0, y: 0 });
        setSliderPos(50);
    }, [file?.id]);

    if (!file) return null;

    const originalSrc = convertFileSrc(file.path);
    const optimizedSrc = file.optimizedPath ? convertFileSrc(file.optimizedPath) : null;

    const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (isDragging) {
            handlePan(e);
            return;
        }

        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const position = ((x - rect.left) / rect.width) * 100;
        setSliderPos(Math.min(Math.max(position, 0), 100));
    };

    const handleWheel = (e: React.WheelEvent) => {
        // Zoom functionality
        if (e.ctrlKey || e.metaKey || true) { // Always zoom on wheel inside comparison? or just ctrl+wheel?
            // Let's go with wheel for zoom for directness
            e.preventDefault();
            const delta = -e.deltaY;
            const factor = delta > 0 ? 1.1 : 0.9;
            const newScale = Math.min(Math.max(scale * factor, 1), 10);
            setScale(newScale);

            if (newScale === 1) {
                setOffset({ x: 0, y: 0 });
            }
        }
    };

    const onMouseDown = (e: React.MouseEvent) => {
        if (scale > 1) {
            setIsDragging(true);
            setStartDrag({ x: e.clientX - offset.x, y: e.clientY - offset.y });
        }
    };

    const handlePan = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDragging) return;
        const x = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const y = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

        setOffset({
            x: x - startDrag.x,
            y: y - startDrag.y
        });
    };

    const onMouseUp = () => {
        setIsDragging(false);
    };

    const resetView = () => {
        setScale(1);
        setOffset({ x: 0, y: 0 });
    };

    const reduction = file.optimizedSize ? Math.round((1 - file.optimizedSize / file.size) * 100) : 0;

    const zoomStyle = {
        transform: `scale(${scale}) translate(${offset.x / scale}px, ${offset.y / scale}px)`,
        transition: isDragging ? 'none' : 'transform 0.1s ease-out'
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/90 backdrop-blur-sm"
            >
                <div
                    className={cn(
                        "relative bg-surface rounded-3xl overflow-hidden shadow-2xl border border-text-main/10 flex flex-col transition-all duration-500",
                        isFullscreen ? 'w-full h-full' : 'w-full max-w-5xl h-[85vh]'
                    )}
                >
                    {/* Header */}
                    <div className="p-6 border-b border-text-main/5 flex items-center justify-between bg-text-main/[0.02]">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                                <Maximize2 className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold tracking-tight uppercase">{file.name}</h3>
                                <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-2">
                                    {file.format} <span className="w-1 h-1 rounded-full bg-text-main/20" />
                                    {reduction}% {t('comparison.reduction')}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {scale > 1 && (
                                <button
                                    onClick={resetView}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-all text-[10px] font-bold uppercase tracking-wider"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    {t('comparison.resetZoom')}
                                </button>
                            )}
                            <div className="flex items-center gap-1 bg-text-main/5 rounded-xl p-1 border border-text-main/5">
                                <button
                                    onClick={() => setScale(Math.max(1, scale - 0.5))}
                                    className="p-2 rounded-lg hover:bg-text-main/10 text-text-muted"
                                >
                                    -
                                </button>
                                <span className="px-2 text-[10px] font-bold text-text-main w-12 text-center">
                                    {(scale * 100).toFixed(0)}%
                                </span>
                                <button
                                    onClick={() => setScale(Math.min(10, scale + 0.5))}
                                    className="p-2 rounded-lg hover:bg-text-main/10 text-text-muted"
                                >
                                    +
                                </button>
                            </div>
                            <button
                                onClick={() => setIsFullscreen(!isFullscreen)}
                                className="p-2.5 rounded-xl hover:bg-text-main/10 transition-all text-text-muted hover:text-text-main border border-transparent hover:border-text-main/10"
                            >
                                {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                            </button>
                            <button
                                onClick={onClose}
                                className="p-2.5 rounded-xl hover:bg-red-500/10 transition-all text-text-muted hover:text-red-500 border border-transparent hover:border-red-500/10"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Comparison Area */}
                    <div
                        className={cn(
                            "flex-1 relative overflow-hidden bg-black/40 group select-none",
                            isDragging ? "cursor-grabbing" : scale > 1 ? "cursor-grab" : "cursor-col-resize"
                        )}
                        ref={containerRef}
                        onMouseMove={handleMouseMove}
                        onTouchMove={handleMouseMove}
                        onWheel={handleWheel}
                        onMouseDown={onMouseDown}
                        onMouseUp={onMouseUp}
                        onMouseLeave={onMouseUp}
                    >
                        {/* Layers Container */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            {/* Original (Background Layer - visible on the left) */}
                            <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                                <img
                                    src={originalSrc}
                                    alt={t('comparison.original')}
                                    className="max-w-full max-h-full object-contain pointer-events-none"
                                    style={zoomStyle}
                                />
                            </div>

                            {/* Optimized (Foreground/Clipped Layer - visible on the right) */}
                            <div
                                className="absolute inset-0 flex items-center justify-center overflow-hidden"
                                style={{ clipPath: `inset(0 0 0 ${sliderPos}%)` }}
                            >
                                <img
                                    src={optimizedSrc || originalSrc}
                                    alt={t('comparison.optimized')}
                                    className="max-w-full max-h-full object-contain pointer-events-none"
                                    style={zoomStyle}
                                />
                            </div>
                        </div>

                        {/* Labels */}
                        <div className="absolute top-6 left-6 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 text-[10px] font-black text-white uppercase tracking-widest z-20 pointer-events-none">
                            {t('comparison.original')} ({(file.size / 1024).toFixed(1)} KB)
                        </div>
                        <div className="absolute top-6 right-6 px-3 py-1.5 bg-primary/60 backdrop-blur-md rounded-lg border border-primary/20 text-[10px] font-black text-white uppercase tracking-widest z-20 pointer-events-none">
                            {t('comparison.optimized')} ({(file.optimizedSize ? file.optimizedSize / 1024 : 0).toFixed(1)} KB)
                        </div>

                        {/* Slider Handle */}
                        <div
                            className={cn(
                                "absolute inset-y-0 z-30 pointer-events-none transition-opacity group-hover:opacity-100",
                                (scale > 1 || isDragging) && "opacity-0" // Hide slider while zooming/panning for clarity?
                            )}
                            style={{ left: `${sliderPos}%` }}
                        >
                            <div className="absolute inset-y-0 -left-px w-0.5 bg-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)]" />
                            <div className="absolute top-1/2 -left-5 -translate-y-1/2 w-10 h-10 bg-primary rounded-full shadow-xl flex items-center justify-center border-4 border-surface text-white">
                                <div className="flex gap-0.5">
                                    <ChevronLeft className="w-3 h-3" />
                                    <ChevronRight className="w-3 h-3" />
                                </div>
                            </div>
                        </div>

                        {/* Hint */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2 bg-black/40 backdrop-blur-xl rounded-full border border-white/10 text-[9px] font-bold text-white uppercase tracking-widest z-40 pointer-events-none"
                        >
                            <Info className="w-3 h-3 text-primary" />
                            {scale > 1 ? t('comparison.hintPan') : t('comparison.hintCompare')}
                        </motion.div>
                    </div>

                    {/* Footer Info */}
                    <div className="p-6 border-t border-text-main/5 grid grid-cols-2 md:grid-cols-4 gap-6 bg-text-main/[0.01]">
                        <InfoStat label={t('comparison.originalSize')} value={`${(file.size / 1024).toFixed(1)} KB`} />
                        <InfoStat label={t('comparison.optimizedSize')} value={`${(file.optimizedSize ? file.optimizedSize / 1024 : 0).toFixed(1)} KB`} color="text-primary" />
                        <InfoStat label={t('comparison.totalReduction')} value={`${reduction}%`} color="text-green-400" />
                        <InfoStat label={t('comparison.format')} value={file.format} />
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

