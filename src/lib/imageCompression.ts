import browserImageCompression from 'browser-image-compression';

export interface ImageCompressionOptions {
  /** Target max file size in MB. Default is 0.25MB (~250KB) */
  maxSizeMB?: number;
  /** Max dimension (width or height). Default is 1600px to ensure serial numbers & text remain crisp */
  maxWidthOrHeight?: number;
  /** Compression initial quality (0.1 to 1.0). Default is 0.8 */
  initialQuality?: number;
  /** Use Web Worker for background non-blocking compression. Default is true */
  useWebWorker?: boolean;
}

export interface CompressionResult {
  file: File;
  originalSizeKB: number;
  compressedSizeKB: number;
  savingsPercent: number;
  isCompressed: boolean;
}

/**
 * Automatically compresses high-resolution smartphone photos (5-15MB)
 * down to ~250KB in the browser before network upload.
 * Reduces 3G/4G upload times from 30+ seconds down to under 1 second.
 */
export async function compressImageForUpload(
  file: File,
  customOptions?: ImageCompressionOptions,
  onProgress?: (progressPercent: number) => void
): Promise<File> {
  // If not an image (or if it's an SVG or animated GIF), skip compression
  const isImage = file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|bmp)$/i.test(file.name);
  const isSvgOrGif = file.type === 'image/svg+xml' || file.type === 'image/gif' || /\.(svg|gif)$/i.test(file.name);

  if (!isImage || isSvgOrGif) {
    return file;
  }

  const originalSizeKB = file.size / 1024;

  // If already compact (<= 250KB), no need to compress further
  if (originalSizeKB <= 250) {
    return file;
  }

  const options = {
    maxSizeMB: customOptions?.maxSizeMB ?? 0.25, // Target ~250KB
    maxWidthOrHeight: customOptions?.maxWidthOrHeight ?? 1600,
    useWebWorker: customOptions?.useWebWorker ?? true,
    initialQuality: customOptions?.initialQuality ?? 0.8,
    onProgress: (pct: number) => {
      if (onProgress) onProgress(pct);
    }
  };

  try {
    const compressedBlob = await browserImageCompression(file, options);
    
    // Retain original name, update timestamp and mime type
    const compressedFile = new File([compressedBlob], file.name, {
      type: compressedBlob.type || file.type || 'image/jpeg',
      lastModified: Date.now()
    });

    const compressedSizeKB = compressedFile.size / 1024;
    const savingsPercent = Math.max(0, Math.round((1 - compressedSizeKB / originalSizeKB) * 100));

    console.log(
      `📸 [Image Compression] "${file.name}": ${(originalSizeKB / 1024).toFixed(2)}MB -> ${(compressedSizeKB).toFixed(0)}KB (${savingsPercent}% saved)`
    );

    // If for any edge-case reason the result is larger, keep the original
    if (compressedFile.size >= file.size) {
      return file;
    }

    return compressedFile;
  } catch (error) {
    console.warn(`[Image Compression] Could not compress "${file.name}", proceeding with original:`, error);
    return file;
  }
}
