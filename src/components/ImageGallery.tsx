import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Download, ZoomIn, User, Wrench, Play, Image as ImageIcon, FileText, FileSpreadsheet, Volume2, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { resolveSupabaseUrl } from "@/lib/supabase";
import { getEvidenceCategory, getEvidenceFileName, getCategoryBadgeInfo, EvidenceCategory } from "@/utils/evidenceFileHelpers";

interface ImageGalleryProps {
    images: string[];
    title: string;
    uploader: "customer" | "technician";
    emptyMessage?: string;
}

function GalleryImage({ url, index, onClick }: { url: string; index: number; onClick: () => void }) {
    const [hasError, setHasError] = useState(false);
    const [loading, setLoading] = useState(true);
    const resolvedUrl = resolveSupabaseUrl(url);

    return (
        <div
            className="relative group cursor-pointer rounded-lg overflow-hidden border border-border/60 hover:border-primary/50 transition-all bg-card shadow-sm aspect-video flex items-center justify-center"
            onClick={onClick}
        >
            {hasError ? (
                <div className="w-full h-full bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center p-2 text-center text-muted-foreground">
                    <ImageIcon className="w-5 h-5 mb-1 text-slate-400" />
                    <span className="text-[10px] font-medium">Failed to load image</span>
                </div>
            ) : (
                <>
                    {loading && (
                        <div className="absolute inset-0 bg-slate-100 dark:bg-slate-800 animate-pulse flex items-center justify-center">
                            <ImageIcon className="w-5 h-5 text-slate-300 animate-bounce" />
                        </div>
                    )}
                    <img
                        src={resolvedUrl}
                        alt={`img-${index}`}
                        loading="lazy"
                        onLoad={() => setLoading(false)}
                        onError={() => {
                            setHasError(true);
                            setLoading(false);
                        }}
                        className={`w-full h-full object-cover transition-opacity duration-300 ${loading ? 'opacity-0' : 'opacity-100'}`}
                    />
                </>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <ZoomIn className="w-6 h-6 text-white" />
            </div>
            <span className="absolute bottom-1.5 left-1.5 text-[9px] font-bold bg-black/60 text-white px-1.5 py-0.5 rounded backdrop-blur-xs">
                PHOTO
            </span>
        </div>
    );
}

function UniversalFileCard({ url, index, category }: { url: string; index: number; category: EvidenceCategory }) {
  const resolvedUrl = resolveSupabaseUrl(url);
  const filename = getEvidenceFileName(url, `File_${index + 1}`);

  if (category === "pdf") {
    return (
      <div
        className="flex flex-col justify-between p-3 border border-red-200 dark:border-red-900/60 rounded-lg bg-red-50/40 dark:bg-red-950/20 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors shadow-xs aspect-video cursor-pointer group"
        onClick={() => window.open(resolvedUrl, "_blank")}
      >
        <div className="flex items-start justify-between gap-1.5">
          <div className="p-1.5 rounded-md bg-red-500/10 text-red-600 dark:text-red-400 shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-red-600 text-white uppercase tracking-wider">
            PDF
          </span>
        </div>
        <div className="min-w-0 my-1">
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 line-clamp-2 leading-tight group-hover:text-red-600 transition-colors" title={filename}>
            {filename}
          </p>
        </div>
        <div className="flex items-center justify-between pt-1 border-t border-red-200/50 dark:border-red-900/40 text-[10px] text-red-600 dark:text-red-400 font-semibold">
          <span>View PDF</span>
          <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    );
  }

  if (category === "spreadsheet") {
    return (
      <div
        className="flex flex-col justify-between p-3 border border-emerald-200 dark:border-emerald-900/60 rounded-lg bg-emerald-50/40 dark:bg-emerald-950/20 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors shadow-xs aspect-video cursor-pointer group"
        onClick={() => window.open(resolvedUrl, "_blank")}
      >
        <div className="flex items-start justify-between gap-1.5">
          <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-600 text-white uppercase tracking-wider">
            CSV / XLS
          </span>
        </div>
        <div className="min-w-0 my-1">
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 line-clamp-2 leading-tight group-hover:text-emerald-600 transition-colors" title={filename}>
            {filename}
          </p>
        </div>
        <div className="flex items-center justify-between pt-1 border-t border-emerald-200/50 dark:border-emerald-900/40 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
          <span>Open Sheet</span>
          <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    );
  }

  if (category === "audio") {
    return (
      <div className="flex flex-col justify-between p-3 border border-amber-200 dark:border-amber-900/60 rounded-lg bg-amber-50/40 dark:bg-amber-950/20 shadow-xs aspect-video">
        <div className="flex items-start justify-between gap-1.5">
          <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
            <Volume2 className="w-5 h-5" />
          </div>
          <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-600 text-white uppercase tracking-wider">
            AUDIO
          </span>
        </div>
        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate my-1" title={filename}>
          {filename}
        </p>
        <audio src={resolvedUrl} controls className="w-full h-7 rounded" />
      </div>
    );
  }

  // Default Document Card (Word, Text, etc.)
  return (
    <div
      className="flex flex-col justify-between p-3 border border-indigo-200 dark:border-indigo-900/60 rounded-lg bg-indigo-50/40 dark:bg-indigo-950/20 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors shadow-xs aspect-video cursor-pointer group"
      onClick={() => window.open(resolvedUrl, "_blank")}
    >
      <div className="flex items-start justify-between gap-1.5">
        <div className="p-1.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
          <FileText className="w-5 h-5" />
        </div>
        <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-indigo-600 text-white uppercase tracking-wider">
          DOC
        </span>
      </div>
      <div className="min-w-0 my-1">
        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 line-clamp-2 leading-tight group-hover:text-indigo-600 transition-colors" title={filename}>
          {filename}
        </p>
      </div>
      <div className="flex items-center justify-between pt-1 border-t border-indigo-200/50 dark:border-indigo-900/40 text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">
        <span>Open Doc</span>
        <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </div>
  );
}

export default function ImageGallery({ images, title, uploader, emptyMessage }: ImageGalleryProps) {
    const [selectedMedia, setSelectedMedia] = useState<string | null>(null);

    useEffect(() => {
        if (!selectedMedia) return;
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setSelectedMedia(null);
            }
        };
        window.addEventListener("keydown", handleKeyDown);

        return () => {
            document.body.style.overflow = originalOverflow;
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [selectedMedia]);

    const styles = uploader === "customer"
        ? { icon: User, borderColor: "border-l-blue-500", bgColor: "bg-blue-50/50", iconColor: "text-blue-600", badge: "bg-blue-100 text-blue-700 border-blue-200" }
        : { icon: Wrench, borderColor: "border-l-emerald-500", bgColor: "bg-emerald-50/50", iconColor: "text-emerald-600", badge: "bg-emerald-100 text-emerald-700 border-emerald-200" };

    const Icon = styles.icon;

    if (!images || images.length === 0) {
        return (
            <div className={`p-4 rounded-xl border-l-4 border ${styles.borderColor} ${styles.bgColor} border-border/40`}>
                <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${styles.iconColor}`} />
                    <h3 className="font-semibold text-sm text-foreground">{title}</h3>
                </div>
                <p className="text-xs text-muted-foreground italic mt-2">{emptyMessage || "No attachments uploaded"}</p>
            </div>
        );
    }

    const videoCount = images.filter(url => getEvidenceCategory(url) === "video").length;
    const imageCount = images.filter(url => getEvidenceCategory(url) === "image").length;
    const pdfCount = images.filter(url => getEvidenceCategory(url) === "pdf").length;
    const sheetCount = images.filter(url => getEvidenceCategory(url) === "spreadsheet").length;
    const docCount = images.filter(url => getEvidenceCategory(url) === "document").length;
    const otherDocsCount = pdfCount + sheetCount + docCount;

    return (
        <>
            <div className={`p-4 rounded-xl border-l-4 border ${styles.borderColor} ${styles.bgColor} border-border/40`}>
                <div className="flex items-center justify-between mb-3.5">
                    <div className="flex items-center gap-2 flex-wrap">
                        <Icon className={`w-4 h-4 ${styles.iconColor}`} />
                        <h3 className="font-semibold text-sm text-foreground">{title}</h3>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${styles.badge}`}>
                            {imageCount > 0 && `${imageCount} photo${imageCount > 1 ? "s" : ""}`}
                            {imageCount > 0 && (videoCount > 0 || otherDocsCount > 0) && " • "}
                            {videoCount > 0 && `${videoCount} video${videoCount > 1 ? "s" : ""}`}
                            {videoCount > 0 && otherDocsCount > 0 && " • "}
                            {pdfCount > 0 && `${pdfCount} PDF${pdfCount > 1 ? "s" : ""}`}
                            {pdfCount > 0 && (sheetCount > 0 || docCount > 0) && " • "}
                            {(sheetCount > 0 || docCount > 0) && `${sheetCount + docCount} doc${sheetCount + docCount > 1 ? "s" : ""}`}
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {images.map((url, index) => {
                        const category = getEvidenceCategory(url);

                        if (category === "video") {
                            return (
                                <div
                                    key={index}
                                    className="relative group cursor-pointer rounded-lg overflow-hidden border border-border/60 hover:border-primary/50 transition-all bg-card shadow-sm aspect-video flex items-center justify-center"
                                    onClick={() => setSelectedMedia(url)}
                                >
                                    <div className="relative w-full h-full bg-slate-950 flex items-center justify-center overflow-hidden">
                                        <video src={resolveSupabaseUrl(url)} className="w-full h-full object-cover opacity-80" muted />
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                            <div className="w-9 h-9 rounded-full bg-black/60 group-hover:bg-black/80 flex items-center justify-center text-white transition-all shadow-md">
                                                <Play className="w-4 h-4 fill-white ml-0.5" />
                                            </div>
                                        </div>
                                    </div>
                                    <span className="absolute bottom-1.5 left-1.5 text-[9px] font-bold bg-black/70 text-white px-1.5 py-0.5 rounded">
                                        VIDEO
                                    </span>
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <ZoomIn className="w-6 h-6 text-white" />
                                    </div>
                                </div>
                            );
                        }

                        if (category === "image") {
                            return (
                                <GalleryImage
                                    key={index}
                                    url={url}
                                    index={index}
                                    onClick={() => setSelectedMedia(url)}
                                />
                            );
                        }

                        return (
                            <UniversalFileCard
                                key={index}
                                url={url}
                                index={index}
                                category={category}
                            />
                        );
                    })}
                </div>
            </div>

            {/* Sleek Lightbox Preview Modal - Portalled directly to document.body, perfectly centered in viewport */}
            {typeof document !== "undefined" && createPortal(
                <AnimatePresence>
                    {selectedMedia && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4"
                            onClick={() => setSelectedMedia(null)}
                        >
                            {/* Compact Modal Box - Fitted snugly around media without giant wasted space */}
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.95, opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                className="relative max-w-[94vw] sm:max-w-3xl max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden inline-flex flex-col mx-auto"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Compact Header Bar */}
                                <div className="flex items-center justify-between px-3 py-2 bg-slate-900 border-b border-slate-800 text-white z-10 shrink-0 gap-2">
                                    <div className="flex items-center gap-1.5 min-w-0 pr-1">
                                        <span className="text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 shrink-0">
                                            {getEvidenceCategory(selectedMedia) === "video" ? "Video" : "Photo"}
                                        </span>
                                        <span className="text-xs font-semibold text-slate-200 truncate max-w-[150px] sm:max-w-xs" title={getEvidenceFileName(selectedMedia)}>
                                            {getEvidenceFileName(selectedMedia)}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <a
                                            href={resolveSupabaseUrl(selectedMedia)}
                                            download
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="h-7 px-2 rounded-md bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1 transition-colors"
                                            title="Download original file"
                                        >
                                            <Download className="w-3.5 h-3.5" />
                                            <span className="hidden sm:inline">Download</span>
                                        </a>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedMedia(null)}
                                            className="w-7 h-7 rounded-md bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                                            title="Close preview"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Media Body - Snugly fitted to natural media dimensions */}
                                <div className="flex items-center justify-center p-1 sm:p-2 bg-black/60 overflow-hidden">
                                    {getEvidenceCategory(selectedMedia) === "video" ? (
                                        <video
                                            src={resolveSupabaseUrl(selectedMedia)}
                                            controls
                                            autoPlay
                                            className="max-h-[72vh] max-w-[90vw] sm:max-w-[700px] w-auto h-auto rounded block mx-auto"
                                        />
                                    ) : getEvidenceCategory(selectedMedia) === "pdf" ? (
                                        <div className="p-6 text-center text-white">
                                            <FileText className="w-12 h-12 text-red-500 mx-auto mb-2" />
                                            <p className="text-sm font-semibold mb-3">{getEvidenceFileName(selectedMedia)}</p>
                                            <a
                                                href={resolveSupabaseUrl(selectedMedia)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-xs font-bold"
                                            >
                                                <ExternalLink className="w-4 h-4" /> Open Full PDF
                                            </a>
                                        </div>
                                    ) : (
                                        <img
                                            src={resolveSupabaseUrl(selectedMedia)}
                                            alt="Preview"
                                            className="max-h-[72vh] max-w-[90vw] sm:max-w-[700px] w-auto h-auto object-contain rounded block mx-auto"
                                        />
                                    )}
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </>
    );
}