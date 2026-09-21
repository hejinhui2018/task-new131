import { describe, expect, it } from 'vitest';
import {
  clampWeight,
  orderFacesByWeight,
  resolveGlyph,
  type AvailableState,
} from '../engine/matching';
import type { FontSource, ReleaseConfig } from '../engine/types';

function src(partial: Partial<FontSource> & { id: string; family: string; weight: FontSource['weight'] }): FontSource {
  return {
    style: 'normal',
    subsets: ['ascii'],
    loadMs: 100,
    widthFactor: 1,
    lineHeightFactor: 1,
    ...partial,
  };
}

const state = (sourceIds: string[] = [], fallbackIds: string[] = []): AvailableState => ({
  loadedSources: new Set(sourceIds),
  failedSources: new Set(),
  loadedFallbacks: new Set(fallbackIds),
});

const config = (sources: FontSource[], stack?: string[]): ReleaseConfig => ({
  versionName: 'test',
  sources,
  stack: stack ?? ['Brand', 'Helvetica Neue', 'sans-serif'],
  fallbacks: [
    { id: 'h', family: 'Helvetica Neue', system: true, widthFactor: 1, lineHeightFactor: 1 },
  ],
  display: 'swap',
  blockPeriodMs: 100,
  swapPeriodMs: 3000,
  requestedWeight: 400,
  requestedStyle: 'normal',
});

const A = 'A'.codePointAt(0)!;

describe('orderFacesByWeight — CSS 字重匹配', () => {
  it('静态精确字重优先', () => {
    const faces = [
      src({ id: 'r', family: 'Brand', weight: 400 }),
      src({ id: 'b', family: 'Brand', weight: 700 }),
    ];
    expect(orderFacesByWeight(faces, 700)[0].id).toBe('b');
    expect(orderFacesByWeight(faces, 400)[0].id).toBe('r');
  });

  it('400 缺失时 500 优先于更重/更轻的距离候选', () => {
    const faces = [
      src({ id: 'b', family: 'Brand', weight: 700 }),
      src({ id: 'm', family: 'Brand', weight: 500 }),
      src({ id: 'l', family: 'Brand', weight: 300 }),
    ];
    expect(orderFacesByWeight(faces, 400)[0].id).toBe('m');
  });

  it('请求 600 缺静态 600 时，区间包含 600 的可变字体命中并钳制到 600', () => {
    const vf = src({ id: 'vf', family: 'Brand', weight: [100, 900], variable: true });
    const bold = src({ id: 'b', family: 'Brand', weight: 700 });
    const ordered = orderFacesByWeight([bold, vf], 600);
    expect(ordered[0].id).toBe('vf');
    expect(clampWeight(vf, 600)).toBe(600);
  });

  it('可变轴越界请求钳制到区间端点', () => {
    const vf = src({ id: 'vf', family: 'Brand', weight: [100, 900], variable: true });
    expect(clampWeight(vf, 950)).toBe(900);
    expect(clampWeight(vf, 50)).toBe(100);
  });

  it('请求超出可变区间时，优先距离更近的静态字重', () => {
    const vf = src({ id: 'vf', family: 'Brand', weight: [100, 700], variable: true });
    const black = src({ id: 'k', family: 'Brand', weight: 900 });
    expect(orderFacesByWeight([vf, black], 900)[0].id).toBe('k');
  });
});

describe('resolveGlyph — family 栈与逐字形回退', () => {
  it('首选族已加载且覆盖码点 → 命中 source', () => {
    const cfg = config([src({ id: 'vf', family: 'Brand', weight: [100, 900], variable: true })]);
    const m = resolveGlyph(A, 600, 'normal', cfg, state(['vf']));
    expect(m.kind).toBe('source');
    expect(m.usedWeight).toBe(600);
    expect(m.missing).toBe(false);
  });

  it('首选族未加载 → 落到系统回退族', () => {
    const cfg = config([src({ id: 'vf', family: 'Brand', weight: 400 })]);
    const m = resolveGlyph(A, 400, 'normal', cfg, state([]));
    expect(m.kind).toBe('fallback');
    expect(m.family).toBe('Helvetica Neue');
  });

  it('首选族已加载但不覆盖该码点 → 逐字形回退到下一族（越南语带调字符场景）', () => {
    const brand = src({ id: 'r', family: 'Brand', weight: 400, subsets: ['ascii'] });
    const cfg = config([brand]);
    const aCircumflexGrave = 'ấ'.codePointAt(0)!; // U+1EA5
    const m = resolveGlyph(aCircumflexGrave, 400, 'normal', cfg, state(['r']));
    expect(m.kind).toBe('fallback');
    expect(m.family).toBe('Helvetica Neue');
    expect(m.missing).toBe(false);
  });

  it('所有族都不覆盖码点 → missing(.notdef)，借用首个就绪族的度量', () => {
    const brand = src({
      id: 'r',
      family: 'Brand',
      weight: 400,
      subsets: ['ascii'],
      widthFactor: 1.1,
    });
    const cfg: ReleaseConfig = {
      ...config([brand]),
      stack: ['Brand', 'TinyFallback'],
      fallbacks: [
        {
          id: 'tiny',
          family: 'TinyFallback',
          system: true,
          widthFactor: 0.9,
          lineHeightFactor: 1,
          coverage: [[0x41, 0x5a]], // 只含大写拉丁
        },
      ],
    };
    const cp = 'あ'.codePointAt(0)!; // 平假名，无人覆盖
    const m = resolveGlyph(cp, 400, 'normal', cfg, state(['r']));
    expect(m.missing).toBe(true);
    expect(m.family).toBe('Brand');
  });

  it('失败的 source 不参与匹配', () => {
    const brand = src({ id: 'r', family: 'Brand', weight: 400 });
    const cfg = config([brand]);
    const s: AvailableState = {
      loadedSources: new Set(),
      failedSources: new Set(['r']),
      loadedFallbacks: new Set(),
    };
    const m = resolveGlyph(A, 400, 'normal', cfg, s);
    expect(m.kind).toBe('fallback');
  });

  it('web 回退字体未加载时跳过，已加载时可用', () => {
    const brand = src({ id: 'r', family: 'Brand', weight: 400, subsets: [] });
    const cfg: ReleaseConfig = {
      ...config([brand], ['Brand', 'WebFB', 'sans-serif']),
      fallbacks: [
        { id: 'wf', family: 'WebFB', system: false, loadMs: 200, widthFactor: 1, lineHeightFactor: 1 },
      ],
    };
    const pending = resolveGlyph(A, 400, 'normal', cfg, state([], []));
    expect(pending.family).toBe('sans-serif');
    const ready = resolveGlyph(A, 400, 'normal', cfg, state([], ['wf']));
    expect(ready.family).toBe('WebFB');
  });
});
