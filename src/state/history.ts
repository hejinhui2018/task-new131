/** 通用撤销/重做栈（纯函数式，配合 React useReducer 使用） */
export interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

export function initHistory<T>(present: T): HistoryState<T> {
  return { past: [], present, future: [] };
}

/** 提交新状态；当前状态压入 past，清空 future */
export function commit<T>(h: HistoryState<T>, next: T): HistoryState<T> {
  if (next === h.present) return h;
  return { past: [...h.past, h.present], present: next, future: [] };
}

export function undo<T>(h: HistoryState<T>): HistoryState<T> {
  if (h.past.length === 0) return h;
  const previous = h.past[h.past.length - 1];
  return {
    past: h.past.slice(0, -1),
    present: previous,
    future: [h.present, ...h.future],
  };
}

export function redo<T>(h: HistoryState<T>): HistoryState<T> {
  if (h.future.length === 0) return h;
  const next = h.future[0];
  return {
    past: [...h.past, h.present],
    present: next,
    future: h.future.slice(1),
  };
}

export function canUndo<T>(h: HistoryState<T>): boolean {
  return h.past.length > 0;
}

export function canRedo<T>(h: HistoryState<T>): boolean {
  return h.future.length > 0;
}
