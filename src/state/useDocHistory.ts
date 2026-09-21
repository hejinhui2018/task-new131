import { useCallback, useMemo, useRef, useState } from 'react';
import type { DocAction, FontRelayDoc } from './store';
import { docReducer } from './store';
import { canRedo, canUndo, commit, redo, undo, type HistoryState } from './history';

const CAP = 100;

export interface DocHistory {
  doc: FontRelayDoc;
  dispatch: (action: DocAction) => void;
  /** 用 reducer 直接替换（不产生历史记录，用于恢复） */
  reset: (doc: FontRelayDoc) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useDocHistory(initial: FontRelayDoc): DocHistory {
  const [h, setH] = useState<HistoryState<FontRelayDoc>>({ past: [], present: initial, future: [] });
  const hRef = useRef(h);
  hRef.current = h;

  const dispatch = useCallback((action: DocAction) => {
    setH((prev) => {
      const next = docReducer(prev.present, action);
      if (next === prev.present) return prev;
      const committed = commit(prev, next);
      return committed.past.length > CAP
        ? { ...committed, past: committed.past.slice(committed.past.length - CAP) }
        : committed;
    });
  }, []);

  const reset = useCallback((doc: FontRelayDoc) => {
    setH({ past: [], present: doc, future: [] });
  }, []);

  const undoFn = useCallback(() => setH((p) => undo(p)), []);
  const redoFn = useCallback(() => setH((p) => redo(p)), []);

  return useMemo(
    () => ({
      doc: h.present,
      dispatch,
      reset,
      undo: undoFn,
      redo: redoFn,
      canUndo: canUndo(h),
      canRedo: canRedo(h),
    }),
    [h, dispatch, reset, undoFn, redoFn],
  );
}
