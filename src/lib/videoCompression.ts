// High-performance client-side video compressor for complaint and installation evidence
// Uses HTML5 Canvas + MediaRecorder with hardware-accelerated playback
// Drastically compresses 1080p/4K phone & drone videos (200MB -> ~15-20MB) in seconds.

export interface VideoCompressionProgress {
  percent: number;
  message: string;
  originalSizeMB: number;
  compressedSizeMB?: number;
}

export const MAX_RAW_VIDEO_FILE_SIZE_MB = 500;
export const MAX_UPLOAD_FILE_SIZE_MB = 100;
export const VIDEO_COMPRESSION_THRESHOLD_MB = 20;

export const isVideoFile = (file: File | { type?: string; name?: string }): boolean => {
  if (!file) return false;
  const mime = file.type || '';
  const name = file.name || '';
  return mime.startsWith('video/') || /\.(mp4|mov|avi|webm|mkv|3gp|m4v|flv)$/i.test(name);
};

export const validateVideoBeforeUpload = (file: File): { valid: boolean; error?: string } => {
  const isVideo = isVideoFile(file);
  const sizeMB = file.size / (1024 * 1024);

  if (isVideo) {
    if (sizeMB > MAX_RAW_VIDEO_FILE_SIZE_MB) {
      return {
        valid: false,
        error: `Video file is too large (Max ${MAX_RAW_VIDEO_FILE_SIZE_MB}MB). Please trim the video or upload a shorter clip.`
      };
    }
  } else {
    if (sizeMB > MAX_UPLOAD_FILE_SIZE_MB) {
      return {
        valid: false,
        error: `File is too large (Max ${MAX_UPLOAD_FILE_SIZE_MB}MB). Please select a smaller file.`
      };
    }
  }

  return { valid: true };
};

export const compressVideoForUpload = async (
  file: File,
  onProgress?: (progress: VideoCompressionProgress) => void
): Promise<File> => {
  const isVideo = isVideoFile(file);
  if (!isVideo) {
    return file;
  }

  const originalSizeMB = file.size / (1024 * 1024);

  // Hard check: Block massive files (> 500MB) immediately
  if (originalSizeMB > MAX_RAW_VIDEO_FILE_SIZE_MB) {
    throw new Error(`Video file is too large (Max ${MAX_RAW_VIDEO_FILE_SIZE_MB}MB). Please trim the video or upload a shorter clip.`);
  }

  // If video is already 20MB or smaller, skip compression for instant upload
  if (originalSizeMB <= VIDEO_COMPRESSION_THRESHOLD_MB) {
    console.log(`[VideoCompression] Video is already <= ${VIDEO_COMPRESSION_THRESHOLD_MB}MB (${originalSizeMB.toFixed(1)}MB), uploading directly.`);
    return file;
  }

  // Check if MediaRecorder is supported
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    console.warn('[VideoCompression] MediaRecorder not available in this environment, using original file.');
    if (originalSizeMB > MAX_UPLOAD_FILE_SIZE_MB) {
      throw new Error(`Video file is too large (Max ${MAX_UPLOAD_FILE_SIZE_MB}MB). Please trim the video or upload a shorter clip.`);
    }
    return file;
  }

  // Detect supported video codecs in order of quality & compatibility
  const candidateTypes = [
    'video/mp4;codecs=avc1',
    'video/mp4;codecs=h264',
    'video/mp4',
    'video/webm;codecs=h264',
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
    if (originalSizeMB > MAX_UPLOAD_FILE_SIZE_MB) {
      throw new Error(`Video file is too large (Max ${MAX_UPLOAD_FILE_SIZE_MB}MB). Please trim the video or upload a shorter clip.`);
    }
    return file;
  }

  onProgress?.({
    percent: 5,
    message: `Compressing video... (5%)`,
    originalSizeMB
  });

  return new Promise((resolve, reject) => {
    let isCompleted = false;
    let activeTimeout: any = null;

    // Safety timeout: 120 seconds max for heavy video files
    let safetyTimeout = setTimeout(() => {
      if (!isCompleted) {
        isCompleted = true;
        console.warn('[VideoCompression] Compression reached safety timeout (120s), checking fallback.');
        cleanup();
        if (originalSizeMB > MAX_UPLOAD_FILE_SIZE_MB) {
          reject(new Error(`Video file is too large (Max ${MAX_UPLOAD_FILE_SIZE_MB}MB). Please trim the video or upload a shorter clip.`));
        } else {
          resolve(file);
        }
      }
    }, 120000);

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
      if (originalSizeMB > MAX_UPLOAD_FILE_SIZE_MB) {
        return reject(new Error(`Video file is too large (Max ${MAX_UPLOAD_FILE_SIZE_MB}MB). Please trim the video or upload a shorter clip.`));
      }
      return resolve(file);
    }

    let mediaRecorder: MediaRecorder | null = null;
    let chunks: Blob[] = [];
    let animationFrameId: number | null = null;

    const cleanup = () => {
      if (activeTimeout) clearTimeout(activeTimeout);
      if (safetyTimeout) clearTimeout(safetyTimeout);
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
      if (activeTimeout) clearTimeout(activeTimeout);
      console.warn('[VideoCompression] Video load error (codec may not be decodable by browser).');
      cleanup();
      if (originalSizeMB > MAX_UPLOAD_FILE_SIZE_MB) {
        reject(new Error(`Video file is too large (Max ${MAX_UPLOAD_FILE_SIZE_MB}MB). Please trim the video or upload a shorter clip.`));
      } else {
        resolve(file);
      }
    };

    video.onloadedmetadata = () => {
      if (isCompleted) return;

      clearTimeout(safetyTimeout);
      const dynamicTimeoutMs = Math.max(90000, ((video.duration || 60) / 2) * 1000 + 20000);
      activeTimeout = setTimeout(() => {
        if (!isCompleted) {
          isCompleted = true;
          console.warn(`[VideoCompression] Compression timeout (${Math.round(dynamicTimeoutMs / 1000)}s), finalizing.`);
          if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
          } else {
            cleanup();
            if (originalSizeMB > MAX_UPLOAD_FILE_SIZE_MB) {
              reject(new Error(`Video file is too large (Max ${MAX_UPLOAD_FILE_SIZE_MB}MB). Please trim the video or upload a shorter clip.`));
            } else {
              resolve(file);
            }
          }
        }
      }, dynamicTimeoutMs);

      // Resolution strategy:
      // For large drone videos (> 100MB): downscale to 480p (854x480) for maximum speed and small size (~15MB)
      // For 20MB-100MB videos: downscale to 720p HD (1280x720)
      const maxDimension = originalSizeMB > 100 ? 854 : 1280;
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

      // Capture stream from canvas at 25 FPS
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
        cleanup();
        if (originalSizeMB > MAX_UPLOAD_FILE_SIZE_MB) {
          return reject(new Error(`Video file is too large (Max ${MAX_UPLOAD_FILE_SIZE_MB}MB). Please trim the video or upload a shorter clip.`));
        }
        return resolve(file);
      }

      // Bitrate strategy:
      // 1.5 Mbps for massive videos (>100MB) to compress 200MB drone files down to ~15-20MB
      // 2.0 - 2.5 Mbps for 20-100MB videos
      const targetBitrate = originalSizeMB > 100 ? 1_500_000 : 2_000_000;

      try {
        mediaRecorder = new MediaRecorder(stream, {
          mimeType: selectedMimeType,
          videoBitsPerSecond: targetBitrate
        });
      } catch (recErr) {
        console.warn('[VideoCompression] MediaRecorder creation failed:', recErr);
        if (isCompleted) return;
        isCompleted = true;
        cleanup();
        if (originalSizeMB > MAX_UPLOAD_FILE_SIZE_MB) {
          return reject(new Error(`Video file is too large (Max ${MAX_UPLOAD_FILE_SIZE_MB}MB). Please trim the video or upload a shorter clip.`));
        }
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
        cleanup();

        const extension = selectedMimeType.includes('mp4') ? 'mp4' : 'webm';
        const compressedBlob = new Blob(chunks, { type: selectedMimeType });
        const compressedSizeMB = compressedBlob.size / (1024 * 1024);

        console.log(`[VideoCompression] Finished: ${originalSizeMB.toFixed(1)}MB -> ${compressedSizeMB.toFixed(1)}MB (${Math.round((1 - compressedSizeMB / originalSizeMB) * 100)}% reduction)`);

        // If compression resulted in larger file or corrupt size, fallback to original
        if (compressedBlob.size >= file.size || compressedBlob.size < 1000) {
          if (originalSizeMB > MAX_UPLOAD_FILE_SIZE_MB) {
            return reject(new Error(`Video file is too large (Max ${MAX_UPLOAD_FILE_SIZE_MB}MB). Please trim the video or upload a shorter clip.`));
          }
          return resolve(file);
        }

        // Post-compression check: strictly ensure under 100MB limit
        if (compressedSizeMB > MAX_UPLOAD_FILE_SIZE_MB) {
          return reject(new Error(`Video file is too large (Max ${MAX_UPLOAD_FILE_SIZE_MB}MB). Please trim the video or upload a shorter clip.`));
        }

        const baseName = file.name.replace(/\.[^/.]+$/, "");
        const compressedFile = new File([compressedBlob], `${baseName}-optimized.${extension}`, {
          type: selectedMimeType.split(';')[0],
          lastModified: Date.now()
        });

        onProgress?.({
          percent: 100,
          message: `Compressing video... (100%)`,
          originalSizeMB,
          compressedSizeMB
        });

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
          const pct = Math.min(99, Math.round((video.currentTime / video.duration) * 95) + 5);
          onProgress?.({
            percent: pct,
            message: `Compressing video... (${pct}%)`,
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
        cleanup();
        if (originalSizeMB > MAX_UPLOAD_FILE_SIZE_MB) {
          reject(new Error(`Video file is too large (Max ${MAX_UPLOAD_FILE_SIZE_MB}MB). Please trim the video or upload a shorter clip.`));
        } else {
          resolve(file);
        }
      });
    };
  });
};

export const validateVideoSize = (file: File, maxMB = MAX_UPLOAD_FILE_SIZE_MB): boolean => {
  const maxSize = maxMB * 1024 * 1024;
  return file.size <= maxSize;
};