import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface PreviewContextType {
    thumbnails: Record<string, string>;
    failures: Record<string, boolean>;
    generatePreview: (id: string, path: string) => void;
    revokeThumbnail: (id: string) => void;
}

const PreviewContext = createContext<PreviewContextType | null>(null);

export const PreviewProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
    const [failures, setFailures] = useState<Record<string, boolean>>({});
    const thumbnailsRef = useRef<Record<string, string>>({});
    const pendingRef = useRef<Set<string>>(new Set());
    const requests = useRef(new Map<string, object>());

    const generatePreview = useCallback(async (id: string, path: string) => {
        // If already exists or processing, skip
        if (thumbnailsRef.current[id] || pendingRef.current.has(id)) {
            return;
        }

        setFailures(previous => { const next = { ...previous }; delete next[id]; return next; });
        pendingRef.current.add(id);
        const request = {};
        requests.current.set(id, request);

        try {
            // Call Rust command
            const thumbnailBytes = await invoke<number[]>('generate_thumbnail', { path });

            if (requests.current.get(id) !== request) return;
            // Convert to Blob
            const blob = new Blob([new Uint8Array(thumbnailBytes)], { type: 'image/jpeg' });
            const url = URL.createObjectURL(blob);

            thumbnailsRef.current[id] = url;
            setThumbnails(prev => ({ ...prev, [id]: url }));
        } catch (error) {
            if (requests.current.get(id) === request) {
                setFailures(previous => ({ ...previous, [id]: true }));
                console.error(`Thumbnail generation failed for ${id}:`, error);
            }
        } finally {
            if (requests.current.get(id) === request) { pendingRef.current.delete(id); requests.current.delete(id); }
        }
    }, []);

    const revokeThumbnail = useCallback((id: string) => {
        requests.current.delete(id);
        pendingRef.current.delete(id);
        setFailures(previous => { const next = { ...previous }; delete next[id]; return next; });
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
            requests.current.clear();
        };
    }, []);

    return (
        <PreviewContext.Provider value={{ thumbnails, failures, generatePreview, revokeThumbnail }}>
            {children}
        </PreviewContext.Provider>
    );
};

export const usePreview = () => {
    const context = useContext(PreviewContext);
    if (!context) throw new Error('usePreview must be used within PreviewProvider');
    return context;
};
