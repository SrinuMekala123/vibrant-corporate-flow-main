// High-performance client-side video compressor for complaint evidence
// Uses HTML5 Canvas + MediaRecorder with hardware-accelerated playback
// Drastically compresses 1080p/4K phone videos down by 75-95% in seconds.

export interface VideoCompressionProgress {
  percent: number;
  message: string;
  originalSizeMB: number;
  compressedSizeMB?: number;
}

export const compressVideoForUpload = async (
  file: File,
  onProgress?: (progress: VideoCompressionProgress) => void
): Promise<File> => {
  // If not a video or already small (<= 6MB), return directly without overhead
  const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|avi|webm|mkv|3gp)$/i.test(file.name);
  if (!isVideo) {
    return file;
  }

  const originalSizeMB = file.size / (1024 * 1024);
  if (originalSizeMB <= 6) {
    console.log(`[VideoCompression] File is already small (${originalSizeMB.toFixed(1)}MB), uploading directly.`);
    return file;
  }

  // Check if MediaRecorder is supported
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    console.warn('[VideoCompression] MediaRecorder not available in this environment, using original file.');
    return file;
  }

  // Detect supported video codecs in order of quality & compatibility
  const candidateTypes = [
    'video/mp4;codecs=avc1',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp8',
    'video/webm'
  ];

  let selectedMimeType = '';
  for (const mime of candidateTypes) {
    if (MediaRecorder.isTypeSupported(mime)) {
      selectedMimeType = mime;
      break;
    }
  }

  if (!selectedMimeType) {
    console.warn('[VideoCompression] No compatible MediaRecorder MIME type found, using original file.');
    return file;
  }

  onProgress?.({
    percent: 5,
    message: `Optimizing video (${originalSizeMB.toFixed(1)}MB)...`,
    originalSizeMB
  });

  return new Promise((resolve) => {
    let isCompleted = false;

    // Safety timeout: abort if compression takes over 25 seconds
    const safetyTimeout = setTimeout(() => {
      if (!isCompleted) {
        isCompleted = true;
        console.warn('[VideoCompression] Compression reached safety timeout (25s), proceeding with original file.');
        cleanup();
        resolve(file);
      }
    }, 25000);

    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { alpha: false });

    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';

    let videoUrl = '';
    try {
      videoUrl = URL.createObjectURL(file);
      video.src = videoUrl;
    } catch (err) {
      console.warn('[VideoCompression] Failed to create object URL:', err);
      clearTimeout(safetyTimeout);
      return resolve(file);
    }

    let mediaRecorder: MediaRecorder | null = null;
    let chunks: Blob[] = [];
    let animationFrameId: number | null = null;

    const cleanup = () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (videoUrl) {
        try { URL.revokeObjectURL(videoUrl); } catch (_) {}
      }
      try {
        video.pause();
        video.removeAttribute('src');
        video.load();
      } catch (_) {}
    };

    video.onerror = () => {
      if (isCompleted) return;
      isCompleted = true;
      clearTimeout(safetyTimeout);
      console.warn('[VideoCompression] Video load error (codec may not be decodable by browser), uploading original.');
      cleanup();
      resolve(file);
    };

    video.onloadedmetadata = () => {
      if (isCompleted) return;

      // Target resolution: 720p HD (1280x720) or 540p (960x540 for large >30MB files)
      const maxDimension = originalSizeMB > 30 ? 960 : 1280;
      let targetWidth = video.videoWidth || 1280;
      let targetHeight = video.videoHeight || 720;

      if (targetWidth > maxDimension || targetHeight > maxDimension) {
        if (targetWidth > targetHeight) {
          targetHeight = Math.round((targetHeight * maxDimension) / targetWidth);
          targetWidth = maxDimension;
        } else {
          targetWidth = Math.round((targetWidth * maxDimension) / targetHeight);
          targetHeight = maxDimension;
        }
      }

      // Dimensions must be even integers for video encoders
      targetWidth = targetWidth - (targetWidth % 2);
      targetHeight = targetHeight - (targetHeight % 2);

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      // Capture stream from canvas
      let stream: MediaStream | null = null;
      try {
        if (canvas.captureStream) {
          stream = canvas.captureStream(25);
        } else if ((canvas as any).mozCaptureStream) {
          stream = (canvas as any).mozCaptureStream(25);
        }
      } catch (streamErr) {
        console.warn('[VideoCompression] Stream capture failed:', streamErr);
      }

      if (!stream) {
        if (isCompleted) return;
        isCompleted = true;
        clearTimeout(safetyTimeout);
        cleanup();
        return resolve(file);
      }

      // 1.2 Mbps for evidence video provides sharp clarity while keeping file sizes small (~9MB/min)
      const targetBitrate = originalSizeMB > 30 ? 1_000_000 : 1_400_000;

      try {
        mediaRecorder = new MediaRecorder(stream, {
          mimeType: selectedMimeType,
          videoBitsPerSecond: targetBitrate
        });
      } catch (recErr) {
        console.warn('[VideoCompression] MediaRecorder creation failed:', recErr);
        if (isCompleted) return;
        isCompleted = true;
        clearTimeout(safetyTimeout);
        cleanup();
        return resolve(file);
      }

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (isCompleted) return;
        isCompleted = true;
        clearTimeout(safetyTimeout);

        const extension = selectedMimeType.includes('mp4') ? 'mp4' : 'webm';
        const compressedBlob = new Blob(chunks, { type: selectedMimeType });
        const compressedSizeMB = compressedBlob.size / (1024 * 1024);

        console.log(`[VideoCompression] Finished: ${originalSizeMB.toFixed(1)}MB -> ${compressedSizeMB.toFixed(1)}MB (${Math.round((1 - compressedSizeMB / originalSizeMB) * 100)}% smaller)`);

        // If compression failed to reduce size or is corrupt, return original
        if (compressedBlob.size >= file.size || compressedBlob.size < 1000) {
          cleanup();
          return resolve(file);
        }

        const baseName = file.name.replace(/\.[^/.]+$/, "");
        const compressedFile = new File([compressedBlob], `${baseName}-optimized.${extension}`, {
          type: selectedMimeType.split(';')[0],
          lastModified: Date.now()
        });

        onProgress?.({
          percent: 100,
          message: `Optimized: ${originalSizeMB.toFixed(1)}MB -> ${compressedSizeMB.toFixed(1)}MB (${Math.round((1 - compressedSizeMB / originalSizeMB) * 100)}% smaller)`,
          originalSizeMB,
          compressedSizeMB
        });

        cleanup();
        resolve(compressedFile);
      };

      // Playback speed acceleration (2.5x speed during capture)
      video.playbackRate = 2.5;

      // Start recorder with 100ms chunk slices
      mediaRecorder.start(100);

      const drawFrame = () => {
        if (video.paused || video.ended || isCompleted) return;
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }

        if (video.duration) {
          const pct = Math.min(95, Math.round((video.currentTime / video.duration) * 90) + 5);
          onProgress?.({
            percent: pct,
            message: `Compressing video: ${pct}%...`,
            originalSizeMB
          });
        }

        animationFrameId = requestAnimationFrame(drawFrame);
      };

      video.onended = () => {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        }
      };

      video.play().then(() => {
        drawFrame();
      }).catch((playErr) => {
        console.warn('[VideoCompression] Video play failed:', playErr);
        if (isCompleted) return;
        isCompleted = true;
        clearTimeout(safetyTimeout);
        cleanup();
        resolve(file);
      });
    };
  });
};

export const validateVideoSize = (file: File): boolean => {
  const maxSize = 50 * 1024 * 1024; // 50MB max
  if (file.size > maxSize) {
    console.warn('Video exceeds maximum 50MB size limit:', file.size);
    return false;
  }
  return true;
};