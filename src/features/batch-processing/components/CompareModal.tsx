import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Info, ChevronLeft, ChevronRight, Maximize2, Minimize2, RotateCcw, Loader2, ImageOff } from 'lucide-react';
import OpenSeadragon from 'openseadragon';
import { FileItem } from '../../../types';
import { useDialogFocus } from '../../../hooks/useDialogFocus';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { cn, formatBytes } from '../../../lib/utils';
import { InfoStat } from '../../../components/ui/InfoStat';
import { useTranslation } from 'react-i18next';

interface CompareModalProps {
    file: FileItem | null;
    onClose: () => void;
}

export const CompareModal: React.FC<CompareModalProps> = ({ file, onClose }) => {
    const { t } = useTranslation();
    const dialog = useDialogFocus(!!file, onClose);
    const [sliderPos, setSliderPos] = useState(50);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isDraggingSlider, setIsDraggingSlider] = useState(false);
    const [scale, setScale] = useState(1);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [retry, setRetry] = useState(0);

    const viewerRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const viewerInstance = useRef<OpenSeadragon.Viewer | null>(null);
    const imagesRef = useRef<{
        left: OpenSeadragon.TiledImage | null;
        right: OpenSeadragon.TiledImage | null;
    }>({ left: null, right: null });

    const sliderPosRef = useRef(50);

    useEffect(() => {
        sliderPosRef.current = sliderPos;
    }, [sliderPos]);

    // Reset view when file changes
    useEffect(() => {
        setSliderPos(50);
        sliderPosRef.current = 50;
        setScale(1);
        setLoadError(null);
        setLoading(true);
    }, [file?.id]);

    const updateZoomDisplay = useCallback(() => {
        const viewer = viewerInstance.current;
        if (!viewer) return;

        const currentZoom = viewer.viewport.getZoom();
        const homeZoom = viewer.viewport.getHomeZoom();
        const newScale = currentZoom / homeZoom;
        setScale(newScale);
    }, []);

    // Update clipping based on slider position
    const updateClipping = useCallback(() => {
        const viewer = viewerInstance.current;
        const { left, right } = imagesRef.current;
        const container = containerRef.current;

        if (!viewer || !left || !right || !container) return;

        try {
            const w = container.clientWidth;
            const h = container.clientHeight;

            const splitX = (w * sliderPosRef.current) / 100;
            const point = new OpenSeadragon.Point(splitX, h / 2);

            const leftPoint = left.viewerElementToImageCoordinates(point);
            const rightPoint = right.viewerElementToImageCoordinates(point);

            const leftSize = left.getContentSize();
            const rightSize = right.getContentSize();

            const lx = Math.max(0, Math.min(leftSize.x, leftPoint.x));
            const rx = Math.max(0, Math.min(rightSize.x, rightPoint.x));

            left.setClip(new OpenSeadragon.Rect(0, 0, lx, leftSize.y));
            right.setClip(new OpenSeadragon.Rect(rx, 0, rightSize.x - rx, rightSize.y));

            left.redraw();
            right.redraw();
        } catch (error) {
            console.error('Error updating clipping:', error);
        }
    }, []);

    // Initialize OpenSeadragon
    useEffect(() => {
        if (!file || !viewerRef.current || file.previewPending || file.error && !file.optimizedPath) return;
        setLoading(true);
        setLoadError(null);

        let disposed = false;
        let finalizeFrame = 0;
        const fail = (error: unknown) => {
            if (disposed) return;
            setLoading(false);
            setLoadError(String(error));
        };

        const viewer = OpenSeadragon({
            element: viewerRef.current,
            drawer: ['canvas', 'html'],
            crossOriginPolicy: 'Anonymous',
            showNavigationControl: false,
            showFullPageControl: false,
            showZoomControl: false,
            showHomeControl: false,
            showSequenceControl: false,
            silenceMultiImageWarnings: true,
            visibilityRatio: 1.0,
            minZoomImageRatio: 0.8,
            maxZoomPixelRatio: 10,
            zoomPerScroll: 1.2,
            animationTime: 0.3,
            gestureSettingsMouse: {
                clickToZoom: false,
                dblClickToZoom: true,
            },
            gestureSettingsTouch: {
                pinchToZoom: true,
                flickEnabled: true,
            },
        });

        viewerInstance.current = viewer;

        const maybeFinalize = () => {
            const { left, right } = imagesRef.current;
            if (disposed || !left || !right) return;

            viewer.world.setItemIndex(left, 0);
            viewer.world.setItemIndex(right, 1);

            viewer.viewport.goHome(true);
            updateClipping();
            finalizeFrame = requestAnimationFrame(() => {
                if (disposed) return;
                updateClipping();
                updateZoomDisplay();
                setLoading(false);
            });
        };

        Promise.all([file.originalPreview ?? file.path, file.optimizedPath ?? file.path].map(path => invoke<string>('prepare_comparison_image', { path }))).then(([original, optimized]) => {
            if (disposed) return;
            viewer.addTiledImage({ width: 1, tileSource: { type: 'image', url: convertFileSrc(original) }, error: () => fail(t('v1.imageLoadError')), success: event => { if (!disposed) { imagesRef.current.left = (event as unknown as { item: OpenSeadragon.TiledImage }).item; maybeFinalize(); } } });
            viewer.addTiledImage({ width: 1, tileSource: { type: 'image', url: convertFileSrc(optimized) }, error: () => fail(t('v1.imageLoadError')), success: event => { if (!disposed) { imagesRef.current.right = (event as unknown as { item: OpenSeadragon.TiledImage }).item; maybeFinalize(); } } });
        }).catch(fail);
        viewer.addHandler('tile-load-failed', () => fail(t('v1.imageLoadError')));

        viewer.addHandler('animation', () => {
            updateClipping();
            updateZoomDisplay();
        });
        viewer.addHandler('animation-finish', () => {
            updateClipping();
            updateZoomDisplay();
        });
        viewer.addHandler('resize', () => {
            updateClipping();
            updateZoomDisplay();
        });
        viewer.addHandler('zoom', updateZoomDisplay);

        return () => {
            disposed = true;
            cancelAnimationFrame(finalizeFrame);
            viewer.destroy();
            viewerInstance.current = null;
            imagesRef.current = { left: null, right: null };
        };
    }, [file?.id, file?.optimizedPath, file?.originalPreview, file?.previewPending, file?.error, retry, t, updateClipping, updateZoomDisplay]);

    useEffect(() => {
        if (imagesRef.current.left && imagesRef.current.right) {
            updateClipping();
        }
    }, [sliderPos, updateClipping]);

    const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDraggingSlider || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const position = ((x - rect.left) / rect.width) * 100;
        setSliderPos(Math.min(Math.max(position, 0), 100));
    };

    const handleSliderMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
        e.stopPropagation();
        setIsDraggingSlider(true);
    };

    const handleMouseUp = () => {
        setIsDraggingSlider(false);
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!file || !viewerInstance.current) return;

            switch (e.key) {
                case 'ArrowLeft':
                    e.preventDefault();
                    setSliderPos(prev => Math.max(0, prev - 5));
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    setSliderPos(prev => Math.min(100, prev + 5));
                    break;
                case '+':
                case '=':
                    e.preventDefault();
                    viewerInstance.current.viewport.zoomBy(1.2);
                    viewerInstance.current.viewport.applyConstraints();
                    break;
                case '-':
                case '_':
                    e.preventDefault();
                    viewerInstance.current.viewport.zoomBy(0.8);
                    viewerInstance.current.viewport.applyConstraints();
                    break;
                case '0':
                    e.preventDefault();
                    resetView();
                    break;
                case 'Escape':
                    onClose();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [file, onClose]);

    useEffect(() => {
        if (!viewerInstance.current) return;

        const viewer = viewerInstance.current;

        if (isDraggingSlider) {
            viewer.setMouseNavEnabled(false);
        } else {
            viewer.setMouseNavEnabled(true);
        }
    }, [isDraggingSlider]);

    if (!file) return null;

    const resetView = () => {
        viewerInstance.current?.viewport.goHome();
        setScale(1);
    };

    const zoomIn = () => {
        viewerInstance.current?.viewport.zoomBy(1.2);
        viewerInstance.current?.viewport.applyConstraints();
    };

    const zoomOut = () => {
        viewerInstance.current?.viewport.zoomBy(0.8);
        viewerInstance.current?.viewport.applyConstraints();
    };

    const reduction = file.optimizedSize != null && file.size > 0
        ? `${Math.round((1 - file.optimizedSize / file.size) * 100)}%` : '—';

    return (
        <AnimatePresence>
            <motion.div
                initial={false}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                ref={dialog} role="dialog" aria-modal="true" aria-label={file.name} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/90"
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
                                <h3 className="text-lg font-semibold tracking-tight">{file.name}</h3>
                                <p className="text-xs font-medium text-text-muted flex items-center gap-2">
                                    {file.format} <span className="w-1 h-1 rounded-full bg-text-main/20" />
                                    {reduction} {t('comparison.reduction')}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {scale > 1.1 && (
                                <button
                                    onClick={resetView}
                                    aria-label={t('comparison.resetZoom')}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-all text-xs font-medium"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    {t('comparison.resetZoom')}
                                </button>
                            )}
                            <div className="flex items-center gap-1 bg-text-main/5 rounded-xl p-1 border border-text-main/5">
                                <button
                                    onClick={zoomOut}
                                    aria-label={t('comparison.zoomOut')}
                                    className="p-2 rounded-lg hover:bg-text-main/10 text-text-muted"
                                >
                                    -
                                </button>
                                <span className="px-2 text-[10px] font-bold text-text-main w-12 text-center">
                                    {(scale * 100).toFixed(0)}%
                                </span>
                                <button
                                    onClick={zoomIn}
                                    aria-label={t('comparison.zoomIn')}
                                    className="p-2 rounded-lg hover:bg-text-main/10 text-text-muted"
                                >
                                    +
                                </button>
                            </div>
                            <button
                                onClick={() => setIsFullscreen(!isFullscreen)}
                                aria-label={isFullscreen ? t('comparison.exitFullscreen') : t('comparison.enterFullscreen')}
                                className="p-2.5 rounded-xl hover:bg-text-main/10 transition-all text-text-muted hover:text-text-main border border-transparent hover:border-text-main/10"
                            >
                                {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                            </button>
                            <button
                                onClick={onClose}
                                aria-label={t('comparison.close')}
                                className="p-2.5 rounded-xl hover:bg-red-500/10 transition-all text-text-muted hover:text-red-500 border border-transparent hover:border-red-500/10"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Comparison Area */}
                    <div
                        ref={containerRef}
                        role="region"
                        aria-label={t('comparison.ariaLabel')}
                        aria-describedby="comparison-hint"
                        className="flex-1 relative overflow-hidden comparison-canvas group select-none"
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        onTouchMove={handleMouseMove}
                        onTouchEnd={handleMouseUp}
                    >
                        {/* OpenSeadragon Container */}
                        <div
                            ref={viewerRef}
                            className="absolute inset-0"
                            style={{ touchAction: 'none' }}
                        />

                        {(file.previewPending || file.error && !file.optimizedPath || loading || loadError) && <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-[#111626]/95 text-white p-8 text-center">
                            {loadError || file.error && !file.optimizedPath ? <><ImageOff size={32} className="text-red-400" /><p role="alert">{t('v1.previewError')}</p><p className="text-sm text-slate-300 max-w-lg break-words">{loadError ?? file.error}</p>{!file.error && <button className="btn-primary" onClick={() => setRetry(value => value + 1)}>{t('v1.retryPreview')}</button>}</> : <><Loader2 size={32} className="animate-spin text-violet-300" /><p role="status">{t(file.previewPending ? 'v1.generatingPreview' : 'v1.loadingImages')}</p><p className="text-sm text-slate-300">{file.name}</p></>}
                        </div>}
                        {/* Labels */}
                        <div className="absolute top-6 left-6 px-3 py-1.5 bg-black/60 rounded-lg border border-white/10 text-xs font-medium text-white z-20 pointer-events-none">
                            {t('comparison.original')} ({formatBytes(file.size, 1)})
                        </div>
                        <div className="absolute top-6 right-6 px-3 py-1.5 bg-[#6550df]/90 rounded-lg border border-primary/20 text-xs font-medium text-white z-20 pointer-events-none">
                            {t('comparison.optimized')} ({file.optimizedSize ? formatBytes(file.optimizedSize, 1) : '—'})
                        </div>

                        {/* Slider Handle */}
                        <div
                            className={cn(
                                "absolute inset-y-0 z-30 transition-opacity",
                                isDraggingSlider ? "opacity-100" : "opacity-60 group-hover:opacity-100"
                            )}
                            style={{ left: `${sliderPos}%` }}
                            role="slider" tabIndex={0} aria-label={t('comparison.ariaLabel')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={sliderPos}
                            onMouseDown={handleSliderMouseDown}
                            onTouchStart={handleSliderMouseDown}
                        >
                            <div className="absolute inset-y-0 -left-px w-0.5 bg-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)] pointer-events-none" />
                            <div className="absolute top-1/2 -left-5 -translate-y-1/2 w-10 h-10 bg-primary rounded-full shadow-xl flex items-center justify-center border-4 border-surface text-white cursor-col-resize">
                                <div className="flex gap-0.5">
                                    <ChevronLeft className="w-3 h-3" />
                                    <ChevronRight className="w-3 h-3" />
                                </div>
                            </div>
                        </div>

                        {/* Hint */}
                        <motion.div
                            id="comparison-hint"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2 bg-black/40 rounded-full border border-white/10 text-xs font-medium text-white z-40 pointer-events-none"
                        >
                            <Info className="w-3 h-3 text-primary" />
                            {scale > 1.1
                                ? t('comparison.hintZoomed')
                                : t('comparison.hintCompare')
                            }
                        </motion.div>
                    </div>

                    {/* Footer Info */}
                    <div className="p-6 border-t border-text-main/5 grid grid-cols-2 md:grid-cols-4 gap-6 bg-text-main/[0.01]">
                        <InfoStat label={t('comparison.originalSize')} value={formatBytes(file.size, 1)} />
                        <InfoStat label={t('comparison.optimizedSize')} value={file.optimizedSize ? formatBytes(file.optimizedSize, 1) : '—'} color="text-primary" />
                        <InfoStat label={t('comparison.totalReduction')} value={reduction} color="text-green-400" />
                        <InfoStat label={file.fidelity != null ? "SSIM" : t('comparison.format')} value={file.fidelity != null ? `${file.fidelity.toFixed(2)}%` : file.format} />
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};
