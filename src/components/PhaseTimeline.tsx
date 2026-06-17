import { cn } from "@/lib/utils";
import { Phase, phaseLabels } from "@/data/mockData";
import { Check } from "lucide-react";

interface PhaseTimelineProps {
  currentPhase: Phase;
}

export function PhaseTimeline({ currentPhase }: PhaseTimelineProps) {
  const phases: Phase[] = [1, 2, 3, 4, 5, 6];

  return (
    <div className="flex items-center gap-1 w-full">
      {phases.map((phase, i) => {
        const isCompleted = phase < currentPhase;
        const isCurrent = phase === currentPhase;
        return (
          <div key={phase} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all border-2",
                  isCompleted && "gradient-primary text-primary-foreground border-transparent",
                  isCurrent && "border-primary text-primary bg-primary/10 animate-pulse-glow",
                  !isCompleted && !isCurrent && "border-border text-muted-foreground bg-muted"
                )}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : phase}
              </div>
              <span className={cn(
                "text-[10px] mt-1.5 text-center leading-tight max-w-[70px]",
                isCurrent ? "text-primary font-semibold" : "text-muted-foreground"
              )}>
                {phaseLabels[phase]}
              </span>
            </div>
            {i < phases.length - 1 && (
              <div className={cn(
                "h-0.5 flex-1 mx-1 rounded-full mt-[-18px]",
                isCompleted ? "gradient-primary" : "bg-border"
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}
