// Simple video compression using browser's built-in capabilities
export const compressVideoForUpload = async (file: File): Promise<File> => {
    // Only compress if file is larger than 10MB
    if (file.size <= 10 * 1024 * 1024) {
        console.log('Video size OK, no compression needed:', file.size);
        return file;
    }

    console.log('Compressing video from:', file.size, 'bytes');

    return new Promise((resolve, reject) => {
        // Create video element to load the file
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        video.preload = 'metadata';
        video.src = URL.createObjectURL(file);

        video.onloadedmetadata = () => {
            // Set canvas dimensions (max 720p)
            let width = video.videoWidth;
            let height = video.videoHeight;

            if (width > 1280) {
                height = (height * 1280) / width;
                width = 1280;
            }

            canvas.width = width;
            canvas.height = height;

            video.currentTime = 0;
        };

        video.onseeked = () => {
            if (!ctx) return;

            // Draw video frame to canvas
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Convert to blob with reduced quality
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        const compressedFile = new File([blob], file.name.replace(/\.(mp4|mov|avi)$/i, '.mp4'), {
                            type: 'video/mp4',
                            lastModified: Date.now(),
                        });
                        console.log('Compressed video size:', compressedFile.size, 'bytes');
                        URL.revokeObjectURL(video.src);
                        resolve(compressedFile);
                    } else {
                        reject(new Error('Failed to compress video'));
                    }
                },
                'video/mp4',
                0.7 // Quality: 70%
            );
        };

        video.onerror = () => {
            URL.revokeObjectURL(video.src);
            reject(new Error('Failed to load video'));
        };
    });
};

// Alternative: Just warn user about large videos
export const validateVideoSize = (file: File): boolean => {
    const maxSize = 50 * 1024 * 1024; // 50MB max
    if (file.size > maxSize) {
        console.warn('Video too large:', file.size);
        return false;
    }
    return true;
};