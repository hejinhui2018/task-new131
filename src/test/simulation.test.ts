import { describe, expect, it } from 'vitest';
import { simulate, simulateRepeated, diffVersions, displayPeriods, frameSignature } from '../engine/simulation';
import { makeScenario, v1Config, v2Config, normalCondition } from '../engine/presets';
import { makeElements } from '../engine/languages';
import type { LoadCondition, Scenario } from '../engine/types';

function scenario(overrides: Partial<Parameters<typeof makeScenario>[0]> = {}): Scenario {
  const config = overrides.config ?? v2Config();
  return makeScenario({
    name: 'test',
    config,
    elements: overrides.elements ?? makeElements('de'),
    condition: overrides.condition,
    containerWidth: overrides.containerWidth ?? 360,
  });
}

describe('simulate — 加载时间线与 font-display', () => {
  it('正常网络：首屏回退 → 字体到达后第一次视觉变化 → 最终稳定使用新字体', () => {
    const res = simulate(scenario());
    const first = res.frames[0];
    const final = res.frames.at(-1)!;

    // 首屏没有任何 source 可用
    expect(first.loadedSources).toHaveLength(0);
    expect(first.t).toBe(0);

    // 第一次视觉变化：block 期（100ms）结束隐形文字显现 —— 这是 swap 策略的真实首变
    expect(res.firstVisualChangeAt).toBe(100);
    expect(res.firstVisualChangeFrame).toBeGreaterThan(0);

    // 字体到达帧再次变化并最终稳定
    const loadFrame = res.frames.find((f) => f.t === 1400)!;
    expect(loadFrame.changedFromFirst).toBe(true);

    // 最终帧使用 BrandSansVF 且无缺字
    const fams = new Set(final.elements.flatMap((e) => e.familiesUsed));
    expect(fams.has('BrandSansVF')).toBe(true);
    expect(res.missingGlyphs).toHaveLength(0);

    // stable 阶段
    expect(final.phase).toBe('stable');
    expect(res.stableAt).toBe(1400);
  });

  it('慢网：加载耗时按 slowdownFactor 放大；block 超时不随网络放大，首变仍为 100ms', () => {
    const slow: LoadCondition = { ...normalCondition(), slowdownFactor: 4 };
    const res = simulate(scenario({ condition: slow }));
    expect(res.firstVisualChangeAt).toBe(100);
    expect(res.stableAt).toBe(5600);
    expect(res.events.find((e) => e.kind === 'font-load')?.t).toBe(5600);
  });

  it('缓存命中：t=0 即可用，首屏即最终态，无视觉变化', () => {
    const cache: LoadCondition = { cacheHitSourceIds: ['v2-brand-vf'], slowdownFactor: 1, networkDown: false };
    const res = simulate(scenario({ condition: cache }));
    expect(res.frames[0].loadedSources).toContain('v2-brand-vf');
    expect(res.firstVisualChangeFrame).toBe(-1);
    expect(res.finalCls).toBe(0);
  });

  it('文件失败：记录 font-fail 事件；block 结束后回退显现，失败后不再发生替换', () => {
    const cfg = v2Config();
    cfg.sources[0].fail = true;
    const res = simulate(scenario({ config: cfg }));
    expect(res.events.some((e) => e.kind === 'font-fail')).toBe(true);
    const final = res.frames.at(-1)!;
    expect(final.failedSources).toContain('v2-brand-vf');
    expect(final.elements.every((e) => !e.familiesUsed.includes('BrandSansVF'))).toBe(true);

    // 首变是 100ms 的回退显现；失败落定时刻（1400ms）视觉与前一帧完全一致
    expect(res.firstVisualChangeAt).toBe(100);
    const reveal = res.frames.find((f) => f.t === 100)!;
    const failFrame = res.frames.find((f) => f.t === 1400)!;
    expect(frameSignature(failFrame)).toBe(frameSignature(reveal));
  });

  it('网络断开：所有 web 字体失败', () => {
    const down: LoadCondition = { cacheHitSourceIds: [], slowdownFactor: 1, networkDown: true };
    const res = simulate(scenario({ condition: down }));
    const final = res.frames.at(-1)!;
    expect(final.loadedSources).toHaveLength(0);
    expect(res.events.filter((e) => e.kind === 'font-fail').length).toBeGreaterThan(0);
  });

  it('font-display optional：错过窗口后字体永不替换', () => {
    const cfg = v2Config();
    cfg.display = 'optional';
    cfg.sources[0].loadMs = 2000;
    const res = simulate(scenario({ config: cfg }));
    const final = res.frames.at(-1)!;
    expect(final.loadedSources).not.toContain('v2-brand-vf');
    expect(res.events.some((e) => e.message.includes('错过'))).toBe(true);
    expect(displayPeriods(cfg).swap).toBe(0);
  });

  it('font-display fallback：swap 窗口内到达会替换，之后到达不替换', () => {
    const cfg = v2Config();
    cfg.display = 'fallback';
    cfg.sources[0].loadMs = 2000; // 窗口 100+3000=3100 内
    const inside = simulate(scenario({ config: cfg }));
    expect(inside.frames.at(-1)!.loadedSources).toContain('v2-brand-vf');

    cfg.sources[0].loadMs = 5000; // 窗口外
    const outside = simulate(scenario({ config: cfg }));
    expect(outside.frames.at(-1)!.loadedSources).not.toContain('v2-brand-vf');
  });
});

describe('simulate — 缺字（越南语）', () => {
  it('v1 旧字体只有 latin 子集：越南语带调字符落到系统回退', () => {
    const res = simulate(
      scenario({ config: v1Config(), elements: makeElements('vi') }),
    );
    const final = res.frames.at(-1)!;
    // 有字符使用了 BrandSans（ascii 部分），同时存在非 BrandSans 的带调字符
    expect(final.elements.some((e) => e.familiesUsed.includes('BrandSans'))).toBe(true);
    const chars = final.elements
      .flatMap((e) => e.lines.flatMap((l) => l.glyphs))
      .filter((g) => g.codePoint >= 0x1ea0 && g.codePoint <= 0x1ef9);
    expect(chars.length).toBeGreaterThan(0);
    expect(chars.every((g) => g.family !== 'BrandSans')).toBe(true);
  });

  it('v2 可变字体含越南语子集：所有字符同族，无缺字', () => {
    const res = simulate(
      scenario({ config: v2Config(), elements: makeElements('vi') }),
    );
    expect(res.missingGlyphs).toHaveLength(0);
    const final = res.frames.at(-1)!;
    const viGlyphs = final.elements
      .flatMap((e) => e.lines.flatMap((l) => l.glyphs))
      .filter((g) => g.codePoint >= 0x1ea0 && g.codePoint <= 0x1ef9);
    expect(viGlyphs.every((g) => g.family === 'BrandSansVF')).toBe(true);
  });
});

describe('simulate — 换行与布局偏移（德语按钮）', () => {
  it('字宽变化改变按钮换行行数，并产生 CLS', () => {
    const res = simulate(
      scenario({ config: v1Config(), elements: makeElements('de'), containerWidth: 360 }),
    );
    const firstButton = res.frames[0].elements.find((e) => e.elementId === 'button')!;
    const finalButton = res.frames.at(-1)!.elements.find((e) => e.elementId === 'button')!;
    // v1 字体 factor 1.06 比回退宽：稳定后行数 ≥ 首屏，且高度发生变化
    expect(finalButton.lineCount).toBeGreaterThanOrEqual(firstButton.lineCount);
    expect(res.finalCls).toBeGreaterThan(0);
  });

  it('窄容器比宽容器更容易换行', () => {
    const narrow = simulate(scenario({ containerWidth: 280 }));
    const wide = simulate(scenario({ containerWidth: 1400 }));
    const nb = narrow.frames.at(-1)!.elements.find((e) => e.elementId === 'body')!;
    const wb = wide.frames.at(-1)!.elements.find((e) => e.elementId === 'body')!;
    expect(nb.lineCount).toBeGreaterThan(wb.lineCount);
    expect(wb.lineCount).toBe(1);
  });

  it('CLS 为非负数且各帧 clsDelta 累计等于 finalCls', () => {
    const res = simulate(scenario());
    const sum = res.frames.reduce((s, f) => s + f.clsDelta, 0);
    expect(Math.abs(sum - res.finalCls)).toBeLessThan(1e-12);
    expect(res.frames.every((f) => f.clsDelta >= 0)).toBe(true);
  });

  it('block 期内未加载的 brand 字形不可见但占回退宽度', () => {
    const cfg = v2Config();
    cfg.display = 'block';
    cfg.blockPeriodMs = 3000;
    const res = simulate(scenario({ config: cfg }));
    const blockFrame = res.frames.find((f) => f.t === 0)!;
    expect(blockFrame.phase).toBe('block');
    const glyphs = blockFrame.elements.flatMap((e) => e.lines.flatMap((l) => l.glyphs));
    expect(glyphs.every((g) => g.invisible === true)).toBe(true);
    // block 结束帧（3000ms，字体 1400ms 已到）全部可见
    const after = res.frames.find((f) => f.t === 3000)!;
    expect(after.elements.flatMap((e) => e.lines.flatMap((l) => l.glyphs)).every((g) => !g.invisible)).toBe(true);
  });
});

describe('simulate — 重复注入与重复运行', () => {
  it('重复注入被检测并记录，但只发起一次加载（不改变视觉结果）', () => {
    const cfg = v2Config();
    cfg.sources[0].injections = 3;
    const res = simulate(scenario({ config: cfg }));
    expect(res.duplicateInjections).toEqual([
      { sourceId: 'v2-brand-vf', family: 'BrandSansVF', times: 3 },
    ]);
    const loadStarts = res.events.filter((e) => e.kind === 'load-start' && e.sourceId === 'v2-brand-vf');
    const loadDone = res.events.filter((e) => e.kind === 'font-load' && e.sourceId === 'v2-brand-vf');
    expect(loadStarts).toHaveLength(1);
    expect(loadDone).toHaveLength(1);

    const once = simulate(scenario({ config: { ...cfg, sources: [{ ...cfg.sources[0], injections: 1 }] } }));
    expect(res.finalCls).toBe(once.finalCls);
  });

  it('重复运行两次：指纹、帧数、CLS、稳定时间完全一致（确定性）', () => {
    const [a, b] = simulateRepeated(scenario(), 2);
    expect(b.fingerprint).toBe(a.fingerprint);
    expect(b.frames.length).toBe(a.frames.length);
    expect(b.finalCls).toBe(a.finalCls);
    expect(b.stableAt).toBe(a.stableAt);
    expect(b.frames.map((f) => f.t)).toEqual(a.frames.map((f) => f.t));
    expect(b.events.some((e) => e.kind === 'repeat-run')).toBe(true);
  });
});

describe('diffVersions — 两个发布版本对比', () => {
  it('v1/v2 在字体到达时刻起即产生差异，并能逐元素给出最终差异', () => {
    const sA = scenario({ config: v1Config() });
    const sB = scenario({ config: v2Config() });
    const rA = simulate(sA);
    const rB = simulate(sB);
    const diff = diffVersions(sA, sB, rA, rB, 'v1', 'v2');

    // 两个版本加载完成时间不同（1100/1400），t=0 首屏相同，差异不晚于较早的到达时刻
    expect(diff.firstDifferingAt).toBeGreaterThan(0);
    expect(diff.firstDifferingAt).toBeLessThanOrEqual(1400);
    expect(diff.perElement.length).toBe(3);
    // 至少一个元素最终行数或高度不同
    expect(diff.perElement.some((p) => p.changed)).toBe(true);
  });

  it('相同配置对比：无差异', () => {
    const s = scenario();
    const diff = diffVersions(s, s, simulate(s), simulate(s), 'a', 'b');
    expect(diff.firstDifferingFrame).toBe(-1);
    expect(diff.perElement.every((p) => !p.changed)).toBe(true);
  });

  it('v1 越南语缺字而 v2 不缺：missingA > missingB 或回退族差异被捕获', () => {
    const sA = scenario({ config: v1Config(), elements: makeElements('vi') });
    const sB = scenario({ config: v2Config(), elements: makeElements('vi') });
    const diff = diffVersions(sA, sB, simulate(sA), simulate(sB), 'v1', 'v2');
    const familiesDiffer = diff.perElement.some(
      (p) => JSON.stringify(p.familiesA) !== JSON.stringify(p.familiesB),
    );
    expect(familiesDiffer || diff.missingA !== diff.missingB).toBe(true);
  });
});
