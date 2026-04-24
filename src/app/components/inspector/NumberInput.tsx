"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface NumberInputProps {
  value: string;
  onChange: (value: string) => void;
  step?: number;
  min?: number;
  max?: number;
  defaultUnit?: string;
  placeholder?: string;
  label?: string;
  className?: string;
  allowEmpty?: boolean;
}

function parse(value: string): { num: number | null; unit: string } {
  if (!value) return { num: null, unit: "" };
  const trimmed = value.trim();
  const m = trimmed.match(/^(-?[0-9]*\.?[0-9]+)([a-z%]*)$/i);
  if (!m) return { num: null, unit: "" };
  return { num: parseFloat(m[1]), unit: m[2] };
}

function format(num: number, unit: string): string {
  const rounded = Math.round(num * 100) / 100;
  return rounded.toString() + unit;
}

export function NumberInput({ value, onChange, step = 1, min, max, defaultUnit = "px", placeholder, label, className }: NumberInputProps) {
  const [local, setLocal] = useState(value);
  const localRef = useRef(value);
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setLocal(value);
    localRef.current = value;
  }, [value]);

  const stopHold = () => {
    if (holdTimer.current) {
      clearInterval(holdTimer.current);
      holdTimer.current = null;
    }
  };

  // Global mouseup — ensures hold always stops even if mouse leaves the button or window.
  // Also stop on unmount to prevent orphaned timers when parent remounts with a new key.
  useEffect(() => {
    window.addEventListener("mouseup", stopHold);
    return () => {
      window.removeEventListener("mouseup", stopHold);
      stopHold();
    };
  }, []);

  const bumpFrom = (current: string, delta: number): string => {
    const { num, unit } = parse(current);
    const cur = num ?? 0;
    let next = cur + delta;
    if (typeof min === "number") next = Math.max(min, next);
    if (typeof max === "number") next = Math.min(max, next);
    return format(next, unit || defaultUnit);
  };

  const bump = (delta: number) => {
    const nextStr = bumpFrom(localRef.current, delta);
    localRef.current = nextStr;
    setLocal(nextStr);
    onChange(nextStr);
  };

  const startHold = (delta: number) => {
    bump(delta);
    let count = 0;
    holdTimer.current = setInterval(() => {
      count++;
      // Read always-fresh ref to avoid stale closure
      const d = count > 10 ? delta * 5 : delta;
      const nextStr = bumpFrom(localRef.current, d);
      localRef.current = nextStr;
      setLocal(nextStr);
      onChange(nextStr);
    }, 80);
  };

  return (
    <div className={cn("flex items-center bg-white/[0.04] border border-white/[0.06] rounded-lg focus-within:border-purple-500/30 transition-colors", className)}>
      {label && <span className="text-[9px] text-white/25 px-2 select-none shrink-0 font-mono">{label}</span>}
      <input
        type="text"
        value={local}
        onChange={(e) => {
          setLocal(e.target.value);
          localRef.current = e.target.value;
        }}
        onBlur={() => {
          if (!local.trim()) { onChange(""); return; }
          const { num, unit } = parse(local);
          if (num === null) { onChange(local); return; }
          const useUnit = unit || defaultUnit;
          const str = format(num, useUnit);
          localRef.current = str;
          setLocal(str);
          onChange(str);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") { (e.target as HTMLInputElement).blur(); return; }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            bump(e.shiftKey ? step * 10 : step);
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            bump(e.shiftKey ? -step * 10 : -step);
          }
        }}
        onWheel={(e) => {
          if (document.activeElement !== e.currentTarget) return;
          e.preventDefault();
          bump(e.deltaY < 0 ? step : -step);
        }}
        placeholder={placeholder}
        className="flex-1 min-w-0 bg-transparent px-2 py-1.5 text-[11px] text-white focus:outline-none"
      />
      <div className="flex flex-col border-l border-white/[0.04]">
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); startHold(step); }}
          tabIndex={-1}
          className="px-1 py-0.5 text-white/30 hover:text-white hover:bg-white/[0.04] cursor-pointer transition-colors"
        >
          <ChevronUp className="w-2.5 h-2.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); startHold(-step); }}
          tabIndex={-1}
          className="px-1 py-0.5 text-white/30 hover:text-white hover:bg-white/[0.04] cursor-pointer transition-colors"
        >
          <ChevronDown className="w-2.5 h-2.5" />
        </button>
      </div>
    </div>
  );
}
