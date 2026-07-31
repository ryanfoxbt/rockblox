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

  return [present, set, { undo, redo, canUndo, canRedo }] as const;
}
