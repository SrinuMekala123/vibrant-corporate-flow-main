import { supabase } from "@/lib/supabase";
import { compressImageForUpload } from "@/lib/imageCompression";
import {
  compressVideoForUpload,
  isVideoFile,
  validateVideoBeforeUpload,
  MAX_UPLOAD_FILE_SIZE_MB,
  VIDEO_COMPRESSION_THRESHOLD_MB
} from "@/lib/videoCompression";
import { toast } from "sonner";

export interface UploadProgressState {
  isUploading: boolean;
  phase: 'idle' | 'compressing' | 'uploading' | 'complete' | 'error';
  percent: number;
  message: string;
  fileName: string;
  originalSizeMB?: number;
  compressedSizeMB?: number;
}

export interface UploadFileOptions {
  bucket?: string;
  folder?: string;
  onProgress?: (progress: UploadProgressState) => void;
}

/**
 * Uploads a file to Supabase Storage with automatic video/image compression,
 * hard file size enforcement, and real-time progress callbacks.
 */
export async function uploadEvidenceWithProgress(
  file: File,
  options: UploadFileOptions = {}
): Promise<string> {
  const {
    bucket = 'complaint-media',
    folder = 'evidence',
    onProgress
  } = options;

  const originalSizeMB = file.size / (1024 * 1024);
  const isVideo = isVideoFile(file);
  const isImage = file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|bmp)$/i.test(file.name);

  // 1. Immediate validation before compression
  const validation = validateVideoBeforeUpload(file);
  if (!validation.valid) {
    const errorMsg = validation.error || "File exceeds allowed size limit.";
    toast.error(errorMsg);
    onProgress?.({
      isUploading: false,
      phase: 'error',
      percent: 0,
      message: errorMsg,
      fileName: file.name,
      originalSizeMB
    });
    throw new Error(errorMsg);
  }

  onProgress?.({
    isUploading: true,
    phase: 'compressing',
    percent: 5,
    message: isVideo && originalSizeMB > VIDEO_COMPRESSION_THRESHOLD_MB ? `Compressing video... (5%)` : `Preparing upload...`,
    fileName: file.name,
    originalSizeMB
  });

  let fileToUpload = file;

  // 2. Client-side Compression
  if (isVideo) {
    if (originalSizeMB > VIDEO_COMPRESSION_THRESHOLD_MB) {
      try {
        fileToUpload = await compressVideoForUpload(file, (p) => {
          onProgress?.({
            isUploading: true,
            phase: 'compressing',
            percent: p.percent,
            message: `Compressing video... (${p.percent}%)`,
            fileName: file.name,
            originalSizeMB: p.originalSizeMB,
            compressedSizeMB: p.compressedSizeMB
          });
        });
      } catch (err: any) {
        console.warn("[UploadHelper] Video compression error:", err);
        const errText = err?.message || "Video compression failed";
        if (errText.includes("too large") || errText.includes("Max")) {
          toast.error(errText);
          onProgress?.({
            isUploading: false,
            phase: 'error',
            percent: 0,
            message: errText,
            fileName: file.name,
            originalSizeMB
          });
          throw err;
        }
      }
    }
  } else if (isImage) {
    try {
      fileToUpload = await compressImageForUpload(file, {
        maxSizeMB: 0.25,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
      }, (pct) => {
        onProgress?.({
          isUploading: true,
          phase: 'compressing',
          percent: pct,
          message: `Optimizing photo: ${pct}%...`,
          fileName: file.name,
          originalSizeMB
        });
      });
    } catch (err) {
      console.warn("[UploadHelper] Image compression error, using original:", err);
    }
  }

  // 3. Post-compression hard ceiling check (Strictly Max 100MB)
  const finalSizeMB = fileToUpload.size / (1024 * 1024);
  if (finalSizeMB > MAX_UPLOAD_FILE_SIZE_MB) {
    const errorMsg = `Video file is too large (Max ${MAX_UPLOAD_FILE_SIZE_MB}MB). Please trim the video or upload a shorter clip.`;
    toast.error(errorMsg);
    onProgress?.({
      isUploading: false,
      phase: 'error',
      percent: 0,
      message: errorMsg,
      fileName: file.name,
      originalSizeMB,
      compressedSizeMB: finalSizeMB
    });
    throw new Error(errorMsg);
  }

  // 4. Supabase Storage Upload with Real-Time Progress
  onProgress?.({
    isUploading: true,
    phase: 'uploading',
    percent: 0,
    message: `Uploading to server... (0%)`,
    fileName: fileToUpload.name,
    originalSizeMB,
    compressedSizeMB: finalSizeMB
  });

  const fileExt = fileToUpload.name.split('.').pop() || (isVideo ? 'mp4' : 'jpg');
  const cleanExt = fileExt.toLowerCase();
  const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2)}.${cleanExt}`;
  const contentType = fileToUpload.type || (
    cleanExt === 'mp4' ? 'video/mp4' :
    cleanExt === 'webm' ? 'video/webm' :
    cleanExt === 'png' ? 'image/png' :
    cleanExt === 'jpg' || cleanExt === 'jpeg' ? 'image/jpeg' :
    'application/octet-stream'
  );

  return new Promise<string>((resolve, reject) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    // Use XMLHttpRequest for native upload progress events
    const xhr = new XMLHttpRequest();
    const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${fileName}`;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const pct = Math.min(99, Math.round((event.loaded / event.total) * 100));
        onProgress?.({
          isUploading: true,
          phase: 'uploading',
          percent: pct,
          message: `Uploading to server... (${pct}%)`,
          fileName: fileToUpload.name,
          originalSizeMB,
          compressedSizeMB: finalSizeMB
        });
      }
    };

    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const { data: { publicUrl } } = supabase.storage
          .from(bucket)
          .getPublicUrl(fileName);

        onProgress?.({
          isUploading: false,
          phase: 'complete',
          percent: 100,
          message: `Upload complete! (100%)`,
          fileName: fileToUpload.name,
          originalSizeMB,
          compressedSizeMB: finalSizeMB
        });

        resolve(publicUrl);
      } else {
        console.warn(`[UploadHelper] XHR upload status ${xhr.status}, falling back to SDK upload...`);
        fallbackSdkUpload();
      }
    };

    xhr.onerror = () => {
      console.warn("[UploadHelper] XHR upload network error, falling back to SDK upload...");
      fallbackSdkUpload();
    };

    const fallbackSdkUpload = async () => {
      try {
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(fileName, fileToUpload, {
            cacheControl: '3600',
            upsert: false,
            contentType
          });

        if (uploadError) {
          // If primary bucket failed, try fallback bucket
          const fallbackBucket = bucket === 'installation-evidence' ? 'complaint-media' : 'installation-evidence';
          const { error: fbErr } = await supabase.storage
            .from(fallbackBucket)
            .upload(fileName, fileToUpload, {
              cacheControl: '3600',
              upsert: false,
              contentType
            });

          if (fbErr) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from(fallbackBucket)
            .getPublicUrl(fileName);

          onProgress?.({
            isUploading: false,
            phase: 'complete',
            percent: 100,
            message: `Upload complete! (100%)`,
            fileName: fileToUpload.name,
            originalSizeMB,
            compressedSizeMB: finalSizeMB
          });

          return resolve(publicUrl);
        }

        const { data: { publicUrl } } = supabase.storage
          .from(bucket)
          .getPublicUrl(fileName);

        onProgress?.({
          isUploading: false,
          phase: 'complete',
          percent: 100,
          message: `Upload complete! (100%)`,
          fileName: fileToUpload.name,
          originalSizeMB,
          compressedSizeMB: finalSizeMB
        });

        resolve(publicUrl);
      } catch (sdkErr: any) {
        console.error("[UploadHelper] Supabase storage upload failed:", sdkErr);
        const rawMsg = sdkErr?.message || "Upload failed";
        const isSizeError = rawMsg.toLowerCase().includes("payload too large") ||
                            rawMsg.toLowerCase().includes("entity too large") ||
                            rawMsg.toLowerCase().includes("exceeds") ||
                            rawMsg.toLowerCase().includes("size limit");
        if (isSizeError) {
          toast.error("Video file is too large (Max 100MB). Please trim the video or upload a shorter clip.");
        } else {
          toast.error(`Upload failed: ${rawMsg}`);
        }
        onProgress?.({
          isUploading: false,
          phase: 'error',
          percent: 0,
          message: rawMsg,
          fileName: file.name
        });
        reject(sdkErr);
      }
    };

    // Obtain current token or anon key
    supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token || supabaseAnonKey;
      xhr.open('POST', uploadUrl, true);
      xhr.setRequestHeader('apikey', supabaseAnonKey);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('Content-Type', contentType);
      xhr.setRequestHeader('x-upsert', 'true');
      xhr.send(fileToUpload);
    }).catch(() => {
      fallbackSdkUpload();
    });
  });
}
