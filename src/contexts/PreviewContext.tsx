import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface PreviewContextType {
    thumbnails: Record<string, string>;
    generatePreview: (id: string, path: string) => void;
    revokeThumbnail: (id: string) => void;
}

const PreviewContext = createContext<PreviewContextType | null>(null);

export const PreviewProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
    const thumbnailsRef = useRef<Record<string, string>>({});
    const pendingRef = useRef<Set<string>>(new Set()); // Prevents duplicate requests

    const generatePreview = useCallback(async (id: string, path: string) => {
        // If already exists or processing, skip
        if (thumbnailsRef.current[id] || pendingRef.current.has(id)) {
            return;
        }

        pendingRef.current.add(id);

        try {
            // Call Rust command
            const thumbnailBytes = await invoke<number[]>('generate_thumbnail', { path });

            // Convert to Blob
            const blob = new Blob([new Uint8Array(thumbnailBytes)], { type: 'image/jpeg' });
            const url = URL.createObjectURL(blob);

            thumbnailsRef.current[id] = url;
            setThumbnails(prev => ({ ...prev, [id]: url }));
        } catch (error) {
            console.error(`Thumbnail generation failed for ${id}:`, error);
        } finally {
            pendingRef.current.delete(id);
        }
    }, []);

    const revokeThumbnail = useCallback((id: string) => {
        const url = thumbnailsRef.current[id];
        if (url) {
            URL.revokeObjectURL(url);
            delete thumbnailsRef.current[id];
            setThumbnails(prev => {
                const next = { ...prev };
                delete next[id];
                return next;
            });
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            Object.values(thumbnailsRef.current).forEach(url => {
                URL.revokeObjectURL(url);
            });
            thumbnailsRef.current = {};
            pendingRef.current.clear();
        };
    }, []);

    return (
        <PreviewContext.Provider value={{ thumbnails, generatePreview, revokeThumbnail }}>
            {children}
        </PreviewContext.Provider>
    );
};

export const usePreview = () => {
    const context = useContext(PreviewContext);
    if (!context) throw new Error('usePreview must be used within PreviewProvider');
    return context;
};
