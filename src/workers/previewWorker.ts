/// <reference lib="webworker" />

self.onmessage = async (e: MessageEvent<{ id: string; path: string; src: string }>) => {
    const { id, src } = e.data;

    try {
        const response = await fetch(src);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const blob = await response.blob();

        if (!blob.type.startsWith('image/')) {
            throw new Error('Not an image');
        }

        const bitmap = await createImageBitmap(blob);

        try {
            if (bitmap.width === 0 || bitmap.height === 0) {
                throw new Error('Invalid image dimensions');
            }

            const width = 100;
            const height = Math.round((bitmap.height / bitmap.width) * width);

            const canvas = new OffscreenCanvas(width, height);
            const ctx = canvas.getContext('2d');

            if (!ctx) throw new Error('Failed to get 2d context');

            ctx.drawImage(bitmap, 0, 0, width, height);

            const thumbnailBlob = await canvas.convertToBlob({
                type: 'image/jpeg',
                quality: 0.7
            });

            self.postMessage({ id, thumbnailBlob }, [thumbnailBlob]);
        } finally {
            bitmap.close();
        }
    } catch (error) {
        self.postMessage({
            id,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
