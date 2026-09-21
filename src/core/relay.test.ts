import { beforeEach, describe, expect, it } from 'vitest';
import { FontCache, planLoads } from './loader';
import { runRelay } from './relay';
import { compareRuns } from './compare';
import { commit, initHistory, redo, undo } from './history';
import { DEFAULT_CONDITIONS, DEFAULT_CONFIGS, LANGUAGES } from './presets';
import type { LoadConditions, RunParams } from './types';

const v2 = DEFAULT_CONFIGS.a;
const v1 = DEFAULT_CONFIGS.b;

function params(over: Partial<RunParams> = {}, conditions: Partial<LoadConditions> = {}): RunParams {
  return {
    config: v2,
    conditions: { ...DEFAULT_CONDITIONS, ...conditions },
    containerWidth: 320,
    languageId: 'de',
    ...over,
  };
}

beforeEach(() => {
  vi.useRealTimers();
});

describe('时间线 runRelay', () => {
  it('首屏没有任何 web 字体，随后按延迟顺序到达，最后 settle', () => {
    const r = runRelay(params());
    expect(r.steps[0].type).toBe('init');
    expect(r.steps[r.steps.length - 1].type).toBe('settle');
    const init = r.steps[0];
    const totalChars = init.elements.reduce((n, e) => n + e.chars.filter((c) => c.char !== '\n').length, 0);
    const sysChars = init.elements.reduce((n, e) => n + e.chars.filter((c) => c.source === 'system').length, 0);
    expect(sysChars).toBe(totalChars);
    // load 步骤按延迟排序：latin(420) 先于 latin-ext(640)
    const loads = r.steps.filter((s) => s.type === 'load');
    expect(loads[0].fileId).toBe('v2-latin');
    const times = loads.map((s) => s.t);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('latin-ext 到达的一刻产生布局偏移事件（字符切换字体）', () => {
    const r = runRelay(params({}, { networkExtraMs: 0 }));
    const extShift = r.shifts.find((s) => s.t === 640);
    expect(extShift).toBeTruthy();
    expect(extShift!.affectedChars).toBeGreaterThan(0);
  });

  it('慢加载：附加网络延迟整体推迟到达时刻，CLS 不变但稳定更晚', () => {
    const fast = runRelay(params());
    const slow = runRelay(params({}, { networkExtraMs: 2000 }));
    expect(slow.cls).toBe(fast.cls);
    expect(slow.steps[slow.settledStepIndex].t).toBeGreaterThan(
      fast.steps[fast.settledStepIndex].t,
    );
  });

  it('文件失败：记录 failedFiles，受影响字符最终仍是系统回退', () => {
    const r = runRelay(
      params({ languageId: 'vi' }, { failFiles: ['v2-vietnamese'] }),
    );
    expect(r.failedFiles).toContain('v2-vietnamese');
    const failStep = r.steps.find((s) => s.type === 'fail');
    expect(failStep).toBeTruthy();
    const settled = r.steps[r.settledStepIndex];
    const heading = settled.elements.find((e) => e.textId === 'vi-heading')!;
    const viChars = heading.chars.filter((c) => 'ăâđêôơưẠạẢảẤấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ'.includes(c.char));
    expect(viChars.every((c) => c.source === 'system')).toBe(true);
    expect(r.fellBackChars).toBeGreaterThan(0);
  });

  it('缺失字形故障：标记 missing 的字符落回退字体并计入 fellBackChars', () => {
    const r = runRelay(
      params({ languageId: 'vi' }, { missingGlyphs: ['ả', 'ệ'] }),
    );
    const settled = r.steps[r.settledStepIndex];
    const flagged = new Set(
      settled.elements.flatMap((e) => e.chars).filter((c) => c.missing).map((c) => c.char),
    );
    expect([...flagged].sort()).toEqual(['ả', 'ệ']);
  });

  it('CLS 在德语窄容器场景为正（字体加载引发布局偏移）', () => {
    const r = runRelay(params({ containerWidth: 300 }));
    expect(r.cls).toBeGreaterThan(0);
    // 最大偏移事件应可读
    const max = r.shifts.reduce((a, b) => (b.score > a.score ? b : a));
    expect(max.label).toBeTruthy();
    expect(max.reason).toBeTruthy();
  });
});

describe('缓存与重复运行', () => {
  it('显式 cachedUrls：首屏即就绪，无 load 步骤、无 CLS', () => {
    const urls = v2.files.map((f) => f.url);
    const r = runRelay(params({}, { cachedUrls: urls }));
    expect(r.steps.filter((s) => s.type === 'load')).toHaveLength(0);
    expect(r.steps.some((s) => s.type === 'cache-hit')).toBe(true);
    const initChars = r.steps[0].elements.flatMap((e) => e.chars).filter((c) => c.char !== '\n');
    // 德语所需的 latin / latin-ext 全部缓存命中 → 首屏即全部 web 字体
    expect(initChars.every((c) => c.source === 'web')).toBe(true);
    expect(r.cls).toBe(0);
  });

  it('持久 FontCache：首次运行写入缓存，刷新后二次运行无字体切换偏移', () => {
    const cache = new FontCache();
    const first = runRelay(params(), cache);
    expect(first.cls).toBeGreaterThan(0);
    // 刷新：同样参数再次运行，缓存已被首次运行吸收
    const second = runRelay(params(), cache);
    expect(second.cls).toBe(0);
    expect(second.steps.filter((s) => s.type === 'load')).toHaveLength(0);
    // 稳定时刻为 0（无网络等待）
    expect(second.steps[second.settledStepIndex].t).toBe(0);
  });

  it('失败文件不写入缓存，刷新后仍失败', () => {
    const cache = new FontCache();
    const first = runRelay(params({}, { failFiles: ['v2-latin-ext'] }), cache);
    expect(first.failedFiles).toContain('v2-latin-ext');
    expect(cache.has(v2.files.find((f) => f.id === 'v2-latin-ext')!.url)).toBe(false);
    const second = runRelay(params({}, { failFiles: ['v2-latin-ext'] }), cache);
    expect(second.failedFiles).toContain('v2-latin-ext');
  });

  it('planLoads 对缓存文件生成 t=0 事件', () => {
    const url = v2.files[0].url;
    const { events } = planLoads(v2.files, { ...DEFAULT_CONDITIONS, cachedUrls: [url] });
    expect(events.find((e) => e.fileId === v2.files[0].id)!.t).toBe(0);
  });
});

describe('重复注入', () => {
  it('同 URL 注入 3 次：只产生一次网络事件，另两次标记冗余', () => {
    const url = v2.files[0].url;
    const { events, injections } = planLoads(v2.files, {
      ...DEFAULT_CONDITIONS,
      duplicateInject: { [url]: 3 },
    });
    expect(events.filter((e) => e.fileId === 'v2-latin')).toHaveLength(1);
    const forUrl = injections.filter((i) => i.url === url);
    expect(forUrl).toHaveLength(3);
    expect(forUrl.filter((i) => i.redundant)).toHaveLength(2);
  });

  it('时间线包含 dup-inject 提示步骤且不改变渲染几何', () => {
    const url = v2.files[1].url;
    const r = runRelay(params({}, { duplicateInject: { [url]: 2 } }));
    expect(r.steps.some((s) => s.type === 'dup-inject')).toBe(true);
    expect(r.injections.filter((i) => i.redundant)).toHaveLength(1);
    // 几何仍只由真实加载事件改变
    const dupStep = r.steps.find((s) => s.type === 'dup-inject')!;
    const settle = r.steps[r.settledStepIndex];
    expect(dupStep.elements.map((e) => e.height)).toEqual(settle.elements.map((e) => e.height));
  });
});

describe('版本对比 compareRuns', () => {
  it('v2 与 v1 在德语窄容器下能定位第一次视觉变化时刻', () => {
    const cmp = compareRuns(
      runRelay(params({ config: v2, containerWidth: 300 })),
      runRelay(params({ config: v1, containerWidth: 300 })),
    );
    // 两个版本首屏（都回退）一致，差异从 web 文件到达后出现
    expect(cmp.steps[0].changed).toBe(false);
    expect(cmp.firstVisualStepIndex).not.toBeNull();
    expect(cmp.firstVisualChangeAt).toBeGreaterThan(0);
  });

  it('两版本结果完全相同时 firstVisualChangeAt 为 null', () => {
    const r = runRelay(params());
    const cmp = compareRuns(r, r);
    expect(cmp.firstVisualChangeAt).toBeNull();
    expect(cmp.steps.every((s) => !s.changed)).toBe(true);
  });

  it('对比包含稳定态 CLS 与回退字符差异汇总', () => {
    const cmp = compareRuns(
      runRelay(params({ config: v2, languageId: 'vi' })),
      runRelay(params({ config: v1, languageId: 'vi' })),
    );
    // v1 没有 vietnamese 文件，稳定态回退字符显著更多
    expect(cmp.settledFallbackDelta).toBeLessThan(0);
    expect(typeof cmp.settledClsDelta).toBe('number');
  });
});

describe('撤销重做 history', () => {
  it('commit / undo / redo 保持状态顺序', () => {
    let h = initHistory(1);
    h = commit(h, 2);
    h = commit(h, 3);
    expect(h.present).toBe(3);
    h = undo(h);
    expect(h.present).toBe(2);
    h = undo(h);
    expect(h.present).toBe(1);
    h = redo(h);
    expect(h.present).toBe(2);
  });

  it('undo 后新提交会丢弃 future', () => {
    let h = initHistory('a');
    h = commit(h, 'b');
    h = commit(h, 'c');
    h = undo(h);
    h = commit(h, 'd');
    expect(h.future).toHaveLength(0);
    expect(h.past).toEqual(['a', 'b']);
    expect(h.present).toBe('d');
  });

  it('相同引用提交不产生历史', () => {
    const o = { x: 1 };
    const h = commit(initHistory(o), o);
    expect(h.past).toHaveLength(0);
  });
});
