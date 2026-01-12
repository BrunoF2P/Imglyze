import React, { useEffect } from 'react';
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
    const { thumbnails, generatePreview, revokeThumbnail } = usePreview();
    const thumbnailSrc = thumbnails[id];

    useEffect(() => {
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
            {thumbnailSrc ? (
                <img
                    src={thumbnailSrc}
                    alt={`Preview of ${name}`}
                    className="w-full h-full object-cover animate-in fade-in duration-300"
                    loading="lazy"
                    onError={(e) => {
                        e.currentTarget.style.display = 'none';
                    }}
                />
            ) : (
                <div className="w-full h-full bg-surface/50 animate-pulse flex items-center justify-center">
                    <span className="text-xs text-muted-foreground">Loading...</span>
                </div>
            )}
        </div>
    );
};
