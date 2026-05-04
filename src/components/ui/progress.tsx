import * as React from "react";
import { cn } from "@/lib/utils";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  label?: string;
  showValue?: boolean;
  color?: string;
}

export function Progress({ value, label, showValue = false, color, className, ...props }: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className={cn("w-full", className)} {...props}>
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-1.5">
          {label && <span className="text-[11px] text-white/50">{label}</span>}
          {showValue && (
            <span className="text-[11px] text-white/35 font-mono">{Math.round(clamped)}%</span>
          )}
        </div>
      )}
      <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${clamped}%`,
            background: color ?? "linear-gradient(90deg, #a78bfa, #6366f1)",
          }}
        />
      </div>
    </div>
  );
}
