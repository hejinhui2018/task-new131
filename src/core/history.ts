// 通用撤销 / 重做历史栈（不可变快照）
export interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

export function initHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] };
}

/** 提交一次变更：当前状态压入 past，清空 future */
export function commit<T>(h: History<T>, next: T): History<T> {
  if (next === h.present) return h;
  return { past: [...h.past, h.present], present: next, future: [] };
}

export function undo<T>(h: History<T>): History<T> {
  if (!h.past.length) return h;
  const previous = h.past[h.past.length - 1];
  return {
    past: h.past.slice(0, -1),
    present: previous,
    future: [h.present, ...h.future],
  };
}

export function redo<T>(h: History<T>): History<T> {
  if (!h.future.length) return h;
  const next = h.future[0];
  return {
    past: [...h.past, h.present],
    present: next,
    future: h.future.slice(1),
  };
}

export function canUndo<T>(h: History<T>): boolean {
  return h.past.length > 0;
}

export function canRedo<T>(h: History<T>): boolean {
  return h.future.length > 0;
}
