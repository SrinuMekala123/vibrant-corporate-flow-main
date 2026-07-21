import { useState } from "react";
import { X, Download, ZoomIn, User, Wrench, Play } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ImageGalleryProps {
    images: string[];
    title: string;
    uploader: "customer" | "technician";
    emptyMessage?: string;
}

export default function ImageGallery({ images, title, uploader, emptyMessage }: ImageGalleryProps) {
    const [selectedMedia, setSelectedMedia] = useState<string | null>(null);

    const isVideoUrl = (url: string): boolean => {
        if (!url) return false;
        const cleanUrl = url.split("?")[0].toLowerCase();
        return (
            cleanUrl.endsWith(".mp4") ||
            cleanUrl.endsWith(".webm") ||
            cleanUrl.endsWith(".ogg") ||
            cleanUrl.endsWith(".mov") ||
            cleanUrl.endsWith(".quicktime") ||
            url.includes("video")
        );
    };

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

    const videoCount = images.filter(isVideoUrl).length;
    const imageCount = images.length - videoCount;

    return (
        <>
            <div className={`p-4 rounded-xl border-l-4 border ${styles.borderColor} ${styles.bgColor} border-border/40`}>
                <div className="flex items-center justify-between mb-3.5">
                    <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${styles.iconColor}`} />
                        <h3 className="font-semibold text-sm text-foreground">{title}</h3>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${styles.badge}`}>
                            {imageCount > 0 && `${imageCount} image${imageCount > 1 ? "s" : ""}`}
                            {imageCount > 0 && videoCount > 0 && " • "}
                            {videoCount > 0 && `${videoCount} video${videoCount > 1 ? "s" : ""}`}
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {images.map((url, index) => {
                        const isVideo = isVideoUrl(url);
                        return (
                            <div
                                key={index}
                                className="relative group cursor-pointer rounded-lg overflow-hidden border border-border/60 hover:border-primary/50 transition-all bg-card shadow-sm aspect-video flex items-center justify-center"
                                onClick={() => setSelectedMedia(url)}
                            >
                                {isVideo ? (
                                    <div className="relative w-full h-full bg-slate-950 flex items-center justify-center overflow-hidden">
                                        <video src={url} className="w-full h-full object-cover opacity-80" muted />
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                                            <div className="w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-all shadow-md">
                                                <Play className="w-4 h-4 fill-white ml-0.5" />
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <img src={url} alt={`img-${index}`} className="w-full h-full object-cover" />
                                )}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <ZoomIn className="w-6 h-6 text-white" />
                                </div>
                            </div>
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
                            {isVideoUrl(selectedMedia) ? (
                                <video
                                    src={selectedMedia}
                                    controls
                                    autoPlay
                                    className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl border border-white/10"
                                />
                            ) : (
                                <img
                                    src={selectedMedia}
                                    alt="Selected media"
                                    className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
                                />
                            )}
                        </div>

                        <a
                            href={selectedMedia}
                            download
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute bottom-6 right-6 bg-white hover:bg-slate-100 text-black px-4 py-2 rounded-lg flex items-center gap-2 font-semibold text-sm shadow-lg transition-all"
                        >
                            <Download className="w-4 h-4" /> Download
                        </a>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}