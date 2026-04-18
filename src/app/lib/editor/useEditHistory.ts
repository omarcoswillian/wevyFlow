"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface HistoryState {
  past: string[];
  present: string;
  future: string[];
}

const MAX_HISTORY = 50;
const DEBOUNCE_MS = 400;

export function useEditHistory(initial: string) {
  const [state, setState] = useState<HistoryState>({
    past: [],
    present: initial,
    future: [],
  });

  const pendingBaseRef = useRef<string | null>(null);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialRef = useRef(initial);

  useEffect(() => {
    if (initial !== initialRef.current) {
      initialRef.current = initial;
      if (commitTimer.current) clearTimeout(commitTimer.current);
      pendingBaseRef.current = null;
      setState({ past: [], present: initial, future: [] });
    }
  }, [initial]);

  const commitPending = useCallback(() => {
    if (pendingBaseRef.current === null) return;
    const base = pendingBaseRef.current;
    pendingBaseRef.current = null;
    setState((s) => {
      if (s.present === base) return s;
      return {
        past: [...s.past, base].slice(-MAX_HISTORY),
        present: s.present,
        future: [],
      };
    });
  }, []);

  const setValue = useCallback((next: string, opts?: { immediate?: boolean }) => {
    setState((s) => {
      if (s.present === next) return s;
      if (pendingBaseRef.current === null) {
        pendingBaseRef.current = s.present;
      }
      return { ...s, present: next, future: [] };
    });

    if (commitTimer.current) clearTimeout(commitTimer.current);

    if (opts?.immediate) {
      commitPending();
    } else {
      commitTimer.current = setTimeout(commitPending, DEBOUNCE_MS);
    }
  }, [commitPending]);

  const undo = useCallback(() => {
    if (commitTimer.current) {
      clearTimeout(commitTimer.current);
      commitTimer.current = null;
    }
    commitPending();

    setState((s) => {
      if (s.past.length === 0) return s;
      const previous = s.past[s.past.length - 1];
      return {
        past: s.past.slice(0, -1),
        present: previous,
        future: [s.present, ...s.future],
      };
    });
  }, [commitPending]);

  const redo = useCallback(() => {
    if (commitTimer.current) {
      clearTimeout(commitTimer.current);
      commitTimer.current = null;
    }
    commitPending();

    setState((s) => {
      if (s.future.length === 0) return s;
      const next = s.future[0];
      return {
        past: [...s.past, s.present],
        present: next,
        future: s.future.slice(1),
      };
    });
  }, [commitPending]);

  const reset = useCallback((next: string) => {
    if (commitTimer.current) clearTimeout(commitTimer.current);
    pendingBaseRef.current = null;
    initialRef.current = next;
    setState({ past: [], present: next, future: [] });
  }, []);

  return {
    value: state.present,
    setValue,
    undo,
    redo,
    reset,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}
