import { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type OffCanvasPanelProps = {
  open: boolean;
  onClose: () => void;
  /** Sticky top section (title, avatar, etc.) */
  header?: ReactNode;
  /** Scrollable main content */
  children: ReactNode;
  /** Sticky bottom actions (optional) */
  footer?: ReactNode;
  /** Extra classes on the panel shell */
  className?: string;
  /** Extra classes on the scroll body */
  bodyClassName?: string;
  /** Close when clicking the dimmed backdrop (default true) */
  closeOnBackdrop?: boolean;
};

/**
 * Shared ~80% right slide-over used by Customers-style CRUD pages.
 * Structure: sticky header → scroll body → sticky footer.
 */
export default function OffCanvasPanel({
  open,
  onClose,
  header,
  children,
  footer,
  className,
  bodyClassName,
  closeOnBackdrop = true,
}: OffCanvasPanelProps) {
  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex justify-end"
          onClick={closeOnBackdrop ? onClose : undefined}
          role="presentation"
        >
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 26, stiffness: 220 }}
            className={cn(
              "bg-white w-full max-w-none sm:w-[80vw] h-full relative flex flex-col shadow-xl border-l border-gray-200",
              className
            )}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close panel"
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 hover:bg-slate-100/50 p-1.5 rounded-lg transition-colors z-20"
            >
              <X className="w-5 h-5" />
            </button>

            {header && (
              <div className="flex items-center gap-4 border-b border-slate-100 pb-4 pr-12 shrink-0 px-4 sm:px-6 md:px-8 pt-5 min-w-0">
                {header}
              </div>
            )}

            <div
              className={cn(
                "flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 md:px-8 py-4",
                bodyClassName
              )}
            >
              {children}
            </div>

            {footer && (
              <div className="flex items-center gap-3 shrink-0 px-4 sm:px-6 md:px-8 py-4 border-t border-slate-100 bg-white">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
