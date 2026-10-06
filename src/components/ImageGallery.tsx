import { useState } from "react";
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

            {/* Lightbox Modal */}
            <AnimatePresence>
                {selectedMedia && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm"
                        onClick={() => setSelectedMedia(null)}
                    >
                        <button
                            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all"
                            onClick={() => setSelectedMedia(null)}
                        >
                            <X className="w-6 h-6" />
                        </button>
                        
                        <div className="max-w-4xl max-h-[85vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                            {getEvidenceCategory(selectedMedia) === "video" ? (
                                <video
                                    src={resolveSupabaseUrl(selectedMedia)}
                                    controls
                                    autoPlay
                                    className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl border border-white/10"
                                />
                            ) : getEvidenceCategory(selectedMedia) === "pdf" ? (
                                <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-800 text-center">
                                    <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-600 flex items-center justify-center mx-auto mb-3">
                                        <FileText className="w-8 h-8" />
                                    </div>
                                    <h3 className="font-bold text-base text-foreground break-words">{getEvidenceFileName(selectedMedia)}</h3>
                                    <p className="text-xs text-muted-foreground mt-1 mb-4">Official PDF Document Attachment</p>
                                    <div className="flex gap-2">
                                        <a
                                            href={resolveSupabaseUrl(selectedMedia)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex-1 inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-lg font-semibold text-xs transition-colors"
                                        >
                                            <ExternalLink className="w-4 h-4" /> Open Full PDF
                                        </a>
                                        <a
                                            href={resolveSupabaseUrl(selectedMedia)}
                                            download
                                            className="inline-flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-foreground px-4 py-2.5 rounded-lg font-semibold text-xs transition-colors"
                                        >
                                            <Download className="w-4 h-4" /> Download
                                        </a>
                                    </div>
                                </div>
                            ) : getEvidenceCategory(selectedMedia) === "spreadsheet" ? (
                                <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-800 text-center">
                                    <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                                        <FileSpreadsheet className="w-8 h-8" />
                                    </div>
                                    <h3 className="font-bold text-base text-foreground break-words">{getEvidenceFileName(selectedMedia)}</h3>
                                    <p className="text-xs text-muted-foreground mt-1 mb-4">Spreadsheet / CSV Attachment</p>
                                    <a
                                        href={resolveSupabaseUrl(selectedMedia)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg font-semibold text-xs transition-colors"
                                    >
                                        <Download className="w-4 h-4" /> Open / Download File
                                    </a>
                                </div>
                            ) : getEvidenceCategory(selectedMedia) === "document" ? (
                                <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-800 text-center">
                                    <div className="w-16 h-16 rounded-full bg-indigo-500/10 text-indigo-600 flex items-center justify-center mx-auto mb-3">
                                        <FileText className="w-8 h-8" />
                                    </div>
                                    <h3 className="font-bold text-base text-foreground break-words">{getEvidenceFileName(selectedMedia)}</h3>
                                    <p className="text-xs text-muted-foreground mt-1 mb-4">Document Attachment</p>
                                    <a
                                        href={resolveSupabaseUrl(selectedMedia)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg font-semibold text-xs transition-colors"
                                    >
                                        <Download className="w-4 h-4" /> Open / Download File
                                    </a>
                                </div>
                            ) : (
                                <img
                                    src={resolveSupabaseUrl(selectedMedia)}
                                    alt="Selected media"
                                    className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
                                />
                            )}
                        </div>

                        {getEvidenceCategory(selectedMedia) === "image" && (
                            <a
                                href={resolveSupabaseUrl(selectedMedia)}
                                download
                                target="_blank"
                                rel="noopener noreferrer"
                                className="absolute bottom-6 right-6 bg-white hover:bg-slate-100 text-black px-4 py-2 rounded-lg flex items-center gap-2 font-semibold text-sm shadow-lg transition-all"
                            >
                                <Download className="w-4 h-4" /> Download
                            </a>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}