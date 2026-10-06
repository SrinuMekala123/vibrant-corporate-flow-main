import React from "react";
import { Progress } from "@/components/ui/progress";
import { UploadProgressState } from "@/lib/fileUploadHelper";
import { Video, CloudUpload, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface UploadProgressBarProps {
  progress?: UploadProgressState | null;
  className?: string;
}

export const UploadProgressBar: React.FC<UploadProgressBarProps> = ({ progress, className }) => {
  if (!progress || (!progress.isUploading && progress.phase !== "complete" && progress.phase !== "error")) {
    return null;
  }

  const isCompressing = progress.phase === "compressing";
  const isUploading = progress.phase === "uploading";
  const isComplete = progress.phase === "complete";
  const isError = progress.phase === "error";

  const reductionPercent = progress.originalSizeMB && progress.compressedSizeMB
    ? Math.max(0, Math.round((1 - progress.compressedSizeMB / progress.originalSizeMB) * 100))
    : null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -6, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -6, scale: 0.98 }}
        transition={{ duration: 0.2 }}
        className={cn(
          "w-full rounded-xl border p-3.5 shadow-sm space-y-2.5 transition-colors",
          isComplete
            ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800"
            : isError
            ? "bg-rose-50/70 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800"
            : "bg-primary/5 dark:bg-slate-900/60 border-primary/25 dark:border-primary/40",
          className
        )}
      >
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            {isCompressing && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-semibold text-[11px] bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-300/60 shrink-0">
                <Video className="w-3.5 h-3.5 animate-pulse" /> Compressing Video
              </span>
            )}
            {isUploading && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-semibold text-[11px] bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-300/60 shrink-0">
                <CloudUpload className="w-3.5 h-3.5 animate-bounce" /> Cloud Upload
              </span>
            )}
            {isComplete && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-semibold text-[11px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-300/60 shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Upload Complete
              </span>
            )}
            {isError && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-semibold text-[11px] bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-300/60 shrink-0">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Upload Failed
              </span>
            )}

            {progress.fileName && (
              <span className="truncate font-medium text-foreground text-xs" title={progress.fileName}>
                {progress.fileName}
              </span>
            )}
          </div>

          <span className="font-mono font-bold text-xs text-primary shrink-0">
            {progress.percent}%
          </span>
        </div>

        {/* Real-Time Visual Progress Bar */}
        <div className="space-y-1">
          <Progress
            value={progress.percent}
            className={cn(
              "h-2 w-full bg-slate-200/70 dark:bg-slate-800",
              isComplete && "[&>div]:bg-emerald-600",
              isError && "[&>div]:bg-rose-600"
            )}
          />
        </div>

        {/* Status Message and Size Optimization Summary */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-muted-foreground pt-0.5">
          <span className="font-semibold text-foreground flex items-center gap-1.5">
            {!isComplete && !isError && <Loader2 className="w-3 h-3 animate-spin text-primary shrink-0" />}
            {progress.message}
          </span>

          {progress.originalSizeMB && (
            <div className="flex items-center gap-1.5 font-mono text-[10px]">
              <span>Original: {progress.originalSizeMB.toFixed(1)}MB</span>
              {progress.compressedSizeMB && (
                <>
                  <span>➔</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {progress.compressedSizeMB.toFixed(1)}MB
                  </span>
                  {reductionPercent != null && reductionPercent > 0 && (
                    <span className="text-emerald-700 dark:text-emerald-300 font-semibold">
                      ({reductionPercent}% smaller)
                    </span>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
