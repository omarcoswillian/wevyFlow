import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface StepIndicatorProps {
  steps: string[];
  currentStep: number;
  completedSteps?: number[];
  className?: string;
}

export function StepIndicator({
  steps,
  currentStep,
  completedSteps = [],
  className,
}: StepIndicatorProps) {
  return (
    <div className={cn("flex items-start gap-0", className)}>
      {steps.map((label, index) => {
        const stepNum = index + 1;
        const isCompleted = completedSteps.includes(stepNum) || stepNum < currentStep;
        const isActive = stepNum === currentStep;
        const isPending = !isCompleted && !isActive;

        return (
          <div key={label} className="flex items-start flex-1">
            {/* step node */}
            <div className="flex flex-col items-center shrink-0">
              <div
                className={cn(
                  "w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all duration-200 text-[11px] font-semibold",
                  isCompleted
                    ? "bg-purple-500 border-purple-500 text-white"
                    : isActive
                    ? "bg-transparent border-purple-500 text-purple-400 shadow-[0_0_0_3px_rgba(168,85,247,0.15)]"
                    : "bg-transparent border-white/15 text-white/25"
                )}
              >
                {isCompleted ? <Check className="w-3.5 h-3.5" /> : stepNum}
              </div>
              <span
                className={cn(
                  "text-[10px] mt-1.5 font-medium text-center leading-tight",
                  isCompleted
                    ? "text-white/50"
                    : isActive
                    ? "text-white/80"
                    : "text-white/25"
                )}
              >
                {label}
              </span>
            </div>

            {/* connector line */}
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "flex-1 h-px mt-3.5 mx-1 transition-all duration-300",
                  isCompleted ? "bg-purple-500" : "bg-white/[0.08]"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
