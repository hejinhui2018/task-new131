import { describe, expect, it } from 'vitest';
import { canRedo, canUndo, commit, initHistory, redo, undo } from '../state/history';

describe('history — 撤销/重做', () => {
  it('提交后可撤销回到上一状态，撤销后可重做', () => {
    let h = initHistory(1);
    h = commit(h, 2);
    h = commit(h, 3);
    expect(h.present).toBe(3);
    expect(canUndo(h)).toBe(true);
    expect(canRedo(h)).toBe(false);

    h = undo(h);
    expect(h.present).toBe(2);
    expect(canRedo(h)).toBe(true);

    h = redo(h);
    expect(h.present).toBe(3);
  });

  it('在撤销后提交新状态会清空 redo 栈', () => {
    let h = initHistory(1);
    h = commit(h, 2);
    h = undo(h);
    h = commit(h, 9);
    expect(h.present).toBe(9);
    expect(canRedo(h)).toBe(false);
  });

  it('空栈撤销/重做是安全的 no-op', () => {
    const h = initHistory('x');
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
  });

  it('提交相同引用不产生历史记录', () => {
    const h = initHistory({ a: 1 });
    expect(commit(h, h.present)).toBe(h);
  });
});
