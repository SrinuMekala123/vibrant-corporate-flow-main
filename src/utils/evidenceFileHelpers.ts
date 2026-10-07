export type EvidenceCategory = "image" | "video" | "audio" | "pdf" | "spreadsheet" | "document";

/**
 * Accurately determines the category of an evidence file based on file extension.
 * Crucially avoids false positives like treating anything in the Supabase "/evidence/" bucket as an image.
 */
export function getEvidenceCategory(url: string): EvidenceCategory {
  if (!url || typeof url !== "string") return "document";

  const cleanUrl = url.split("?")[0].split("#")[0].toLowerCase();
  const ext = cleanUrl.includes(".") ? cleanUrl.split(".").pop() || "" : "";

  // 1. Audio
  if (
    ["mp3", "wav", "m4a", "aac", "ogg", "flac", "opus", "wma"].includes(ext) ||
    cleanUrl.includes("/audios/") ||
    cleanUrl.includes("/pir-audio/")
  ) {
    return "audio";
  }

  // 2. Video
  if (
    ["mp4", "webm", "mov", "quicktime", "avi", "mkv", "3gp", "wmv", "flv", "m4v"].includes(ext) ||
    cleanUrl.includes("/videos/")
  ) {
    return "video";
  }

  // 3. PDF
  if (ext === "pdf") {
    return "pdf";
  }

  // 4. Spreadsheets & CSV
  if (["csv", "xls", "xlsx", "ods", "tsv"].includes(ext)) {
    return "spreadsheet";
  }

  // 5. Images (Strictly matching real image extensions)
  if (["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "avif", "heic", "tiff"].includes(ext)) {
    return "image";
  }

  // 6. Office / Text Documents
  if (["doc", "docx", "txt", "rtf", "odt", "ppt", "pptx"].includes(ext)) {
    return "document";
  }

  // Fallback checks on path keywords (excluding "/evidence/" which is just the Supabase bucket name)
  if (cleanUrl.includes("/image/") || cleanUrl.includes("/photos/")) {
    return "image";
  }

  return "document";
}

/**
 * Extracts a clean, human-readable file name from an evidence URL.
 */
export function getEvidenceFileName(url: string, fallback = "Attachment"): string {
  if (!url || typeof url !== "string") return fallback;
  try {
    const raw = url.split("?")[0].split("#")[0].split("/").pop() || fallback;
    const decoded = decodeURIComponent(raw);
    return decoded || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Extracts the clean file extension (without dot), or empty string if not present.
 */
export function getFileExtension(url: string): string {
  if (!url || typeof url !== "string") return "";
  const cleanUrl = url.split("?")[0].split("#")[0].toLowerCase();
  if (cleanUrl.includes(".")) {
    const rawExt = cleanUrl.split(".").pop() || "";
    if (rawExt.length >= 1 && rawExt.length <= 8) return rawExt;
  }
  return "";
}

/**
 * Returns user-facing badge information for each evidence category.
 */
export function getCategoryBadgeInfo(category: EvidenceCategory) {
  switch (category) {
    case "image":
      return { label: "PHOTO", color: "bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-900" };
    case "video":
      return { label: "VIDEO", color: "bg-purple-500/10 text-purple-600 border-purple-200 dark:border-purple-900" };
    case "pdf":
      return { label: "PDF", color: "bg-red-500/10 text-red-600 border-red-200 dark:border-red-900" };
    case "spreadsheet":
      return { label: "EXCEL/CSV", color: "bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-900" };
    case "audio":
      return { label: "AUDIO", color: "bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-900" };
    case "document":
    default:
      return { label: "DOC", color: "bg-indigo-500/10 text-indigo-600 border-indigo-200 dark:border-indigo-900" };
  }
}
