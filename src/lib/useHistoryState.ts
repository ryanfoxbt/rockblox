"use client";

import { useCallback, useRef, useState } from "react";

const MAX_HISTORY = 100;

export function useHistoryState<T>(initial: T | (() => T)) {
  const [present, setPresent] = useState<T>(initial);
  const pastRef = useRef<T[]>([]);
  const futureRef = useRef<T[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const set = useCallback(
    (update: T | ((prev: T) => T)) => {
      const next = typeof update === "function" ? (update as (prev: T) => T)(present) : update;
      pastRef.current.push(present);
      if (pastRef.current.length > MAX_HISTORY) pastRef.current.shift();
      futureRef.current = [];
      setPresent(next);
      setCanUndo(true);
      setCanRedo(false);
    },
    [present]
  );

  const undo = useCallback(() => {
    if (pastRef.current.length === 0) return;
    const previous = pastRef.current.pop()!;
    futureRef.current.push(present);
    setPresent(previous);
    setCanUndo(pastRef.current.length > 0);
    setCanRedo(true);
  }, [present]);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    const next = futureRef.current.pop()!;
    pastRef.current.push(present);
    setPresent(next);
    setCanUndo(true);
    setCanRedo(futureRef.current.length > 0);
  }, [present]);

  // Replaces the present value without recording it in undo history — for
  // swapping in an entirely different document (e.g. switching drum-beat
  // slots), where undo should never jump back to the previous document.
  const reset = useCallback((value: T) => {
    pastRef.current = [];
    futureRef.current = [];
    setPresent(value);
    setCanUndo(false);
    setCanRedo(false);
  }, []);

  return [present, set, { undo, redo, reset, canUndo, canRedo }] as const;
}
