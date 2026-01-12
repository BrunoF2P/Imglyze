import { useMemo } from 'react';
import { FileItem } from '../../../types';

/**
 * Custom hook for file list operations
 * Encapsulates file filtering, sorting, and selection logic
 */
export const useFileList = (files: FileItem[]) => {
    // Get selected files
    const selectedFiles = useMemo(() => {
        return files.filter(f => f.selected);
    }, [files]);

    // Get file count by status
    const statusCounts = useMemo(() => {
        return {
            pending: files.filter(f => f.status === 'Pending').length,
            processing: files.filter(f => f.status === 'Processing').length,
            done: files.filter(f => f.status === 'Done').length,
            error: files.filter(f => f.status === 'Error').length
        };
    }, [files]);

    // Get files by format
    const filesByFormat = useMemo(() => {
        const grouped: Record<string, FileItem[]> = {};
        files.forEach(file => {
            if (!grouped[file.format]) {
                grouped[file.format] = [];
            }
            grouped[file.format].push(file);
        });
        return grouped;
    }, [files]);

    // Calculate total sizes
    const totalSizes = useMemo(() => {
        const original = files.reduce((sum, f) => sum + f.size, 0);
        const optimized = files
            .filter(f => f.status === 'Done' && f.optimizedSize)
            .reduce((sum, f) => sum + (f.optimizedSize || 0), 0);

        return {
            original,
            optimized,
            saved: original - optimized,
            savedPercent: original > 0 ? ((original - optimized) / original) * 100 : 0
        };
    }, [files]);

    // Check if any files are selected
    const hasSelection = selectedFiles.length > 0;

    // Check if processing is complete
    const isComplete = useMemo(() => {
        return selectedFiles.every(f => f.status === 'Done' || f.status === 'Error');
    }, [selectedFiles]);

    return {
        selectedFiles,
        statusCounts,
        filesByFormat,
        totalSizes,
        hasSelection,
        isComplete,
        totalCount: files.length,
        selectedCount: selectedFiles.length
    };
};
