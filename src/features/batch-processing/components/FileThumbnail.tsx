import React, { useEffect, useState } from 'react';
import { ImageOff, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePreview } from '../../../contexts/PreviewContext';

interface FileThumbnailProps {
    id: string;
    path: string;
    name: string;
    className?: string;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
}

export const FileThumbnail: React.FC<FileThumbnailProps> = ({
    id,
    path,
    name,
    className,
    onMouseEnter,
    onMouseLeave
}) => {
    const { thumbnails, failures, generatePreview, revokeThumbnail } = usePreview();
    const { t } = useTranslation();
    const [imageFailed, setImageFailed] = useState(false);
    const thumbnailSrc = thumbnails[id];
    const failed = failures[id] || imageFailed;

    useEffect(() => {
        setImageFailed(false);
        if (thumbnailSrc) {
            revokeThumbnail(id);
        }

        generatePreview(id, path);

        return () => {
            revokeThumbnail(id);
        };

    }, [id, path])

    return (
        <div
            className={className}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            {failed ? (
                <div className="w-full h-full flex items-center justify-center text-text-muted" title={t('v1.imageLoadError')}>
                    <ImageOff size={18} aria-label={t('v1.imageLoadError')} />
                </div>
            ) : thumbnailSrc ? (
                <img
                    src={thumbnailSrc}
                    alt={name}
                    className="w-full h-full object-cover animate-in fade-in duration-300"
                    loading="lazy"
                    onError={() => setImageFailed(true)}
                />
            ) : (
                <div className="w-full h-full bg-surface/50 flex items-center justify-center text-text-muted">
                    <Loader2 size={16} className="animate-spin" aria-label={t('v1.loadingImages')} />
                </div>
            )}
        </div>
    );
};
