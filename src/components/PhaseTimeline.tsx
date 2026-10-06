import { cn } from "@/lib/utils";
import { Phase, phaseLabels } from "@/data/mockData";
import { Check } from "lucide-react";

interface PhaseTimelineProps {
  currentPhase: Phase;
  status?: string;
  activePhase?: number;
  onPhaseClick?: (phase: number) => void;
  isPhase6Verified?: boolean;
}

export function PhaseTimeline({ currentPhase, status, activePhase, onPhaseClick, isPhase6Verified }: PhaseTimelineProps) {
  const phases: Phase[] = [1, 2, 3, 4, 5, 6];
  const normalizedStatus = (status || "").toLowerCase();
  
  const isPendingVerification = normalizedStatus === "pending_verification" || normalizedStatus === "resolution_submitted";
  const isPhase5Completed = currentPhase >= 6 || isPendingVerification || normalizedStatus === "closed" || normalizedStatus === "verified" || normalizedStatus === "qa_verified";
  const isPhase6Completed = isPhase6Verified !== undefined 
    ? isPhase6Verified 
    : (normalizedStatus === "closed" || normalizedStatus === "verified" || normalizedStatus === "qa_verified");
  const isPhase6Ready = !isPhase6Completed && (isPendingVerification || (currentPhase === 5 && !isPhase6Completed));
  
  console.log('[PhaseTimeline] Phase State Debug:', {
    currentPhase,
    status,
    isPhase5Completed,
    isPhase6Completed,
    isPhase6Ready,
    isPendingVerification,
  });
  
  return (
    <div className="grid grid-cols-3 gap-y-5 gap-x-2 md:flex md:items-center md:gap-1 w-full select-none">
      {phases.map((phase, i) => {
        const isCompleted = phase <= 5
          ? (phase < currentPhase || (phase === 5 && isPhase5Completed))
          : isPhase6Completed;

        const isCurrent = !isCompleted && (phase === currentPhase || (phase === 6 && isPhase6Ready));
        const isFinalPhase = phase === 6;
        const isSelected = activePhase === phase;
        
        return (
          <div key={phase} className="flex items-center justify-center md:flex-1">
            <button
              type="button"
              onClick={() => onPhaseClick?.(phase)}
              disabled={!onPhaseClick}
              className={cn(
                "flex flex-col items-center flex-1 outline-none group focus:outline-none transition-all active:scale-95",
                onPhaseClick && "cursor-pointer"
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-xs font-bold transition-all border-2",
                  isCompleted && !isFinalPhase && "gradient-primary text-primary-foreground border-transparent",
                  isCompleted && isFinalPhase && "bg-success text-success-foreground border-transparent shadow-[0_0_14px_rgba(34,197,94,0.5)]",
                  isCurrent && !isFinalPhase && "border-primary text-primary bg-primary/10 animate-pulse-glow",
                  isCurrent && isFinalPhase && "border-amber-500 text-amber-700 bg-amber-50 animate-pulse-glow",
                  !isCompleted && !isCurrent && "border-border text-muted-foreground bg-muted",
                  isSelected && "ring-4 ring-primary/40 scale-110 shadow-glow"
                )}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : phase}
              </div>
              <span className={cn(
                "text-[10px] mt-1.5 text-center leading-tight max-w-[70px] transition-colors group-hover:text-primary",
                isFinalPhase && isPhase6Completed ? "text-success font-bold" :
                isCurrent && isFinalPhase ? "text-amber-700 font-bold" :
                isSelected ? "text-primary font-bold" :
                isCurrent ? "text-primary font-semibold" : "text-muted-foreground"
              )}>
                {phase === 6 && isPhase6Ready && !isPhase6Completed ? "Ready for QA" : phaseLabels[phase]}
                {isFinalPhase && isPhase6Completed && " ✓"}
              </span>
            </button>
            {i < phases.length - 1 && (
              <div className={cn(
                "h-0.5 flex-1 mx-1 rounded-full md:mt-[-22px] hidden md:block",
                (phase < currentPhase || (phase === 5 && isPhase6Completed)) ? (phase === 5 && isPhase6Completed ? "bg-success" : "gradient-primary") : "bg-border"
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}
