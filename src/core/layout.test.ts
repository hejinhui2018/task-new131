import { describe, expect, it } from 'vitest';
import { layoutElement, wrapLines } from './layout';
import { matchText } from './matcher';
import { DEFAULT_CONFIGS } from './presets';
import type { MatchContext } from './matcher';
import type { SampleText } from './types';

const v2 = DEFAULT_CONFIGS.a;
const ctxp = (ready: string[]): MatchContext => ({
  config: v2,
  readyFileIds: new Set(ready),
  missingOverride: new Set(),
});

const button: SampleText = {
  id: 'b',
  label: '按钮',
  kind: 'button',
  text: 'Jetzt kostenlos herunterladen',
  weight: 600,
  fontSize: 16,
};

describe('换行 wrapLines', () => {
  it('容器足够宽时单行', () => {
    const text = 'Jetzt kostenlos';
    const widths = Array.from(text).map(() => 10);
    const lines = wrapLines(text, widths, 1000);
    expect(lines).toEqual([[0, Array.from(text).length]]);
  });

  it('超宽时在空格处断行，空格随上一行', () => {
    const text = 'aaaa bbbb cccc';
    const widths = Array.from(text).map((c) => (c === ' ' ? 4 : 20));
    // 一行约放 7 个字符宽
    const lines = wrapLines(text, widths, 90);
    expect(lines.length).toBeGreaterThan(1);
    // 每个断点都应落在词间
    for (const [s, e] of lines) {
      expect(text.slice(s, e).startsWith(' ')).toBe(false);
    }
  });

  it('CJK 文本可在任意字符间断行', () => {
    const text = '全新可变字体系统';
    const widths = Array.from(text).map(() => 40);
    const lines = wrapLines(text, widths, 120);
    expect(lines).toEqual([
      [0, 3],
      [3, 6],
      [6, 8],
    ]);
  });
});

describe('布局快照 layoutElement', () => {
  const resolverSys = () => v2.fallbacks[0].metrics;
  const resolverMixed = (fileId: string | null) =>
    fileId ? v2.files.find((f) => f.id === fileId)!.metrics : v2.fallbacks[0].metrics;
  const allReady = v2.files.map((f) => f.id);

  it('web 字体自然宽度大于系统回退（德语按钮加载后换行的根因）', () => {
    const sys = layoutElement(
      button,
      matchText(button.text, button.weight, button.fontSize, ctxp([])),
      4000,
      resolverSys,
    );
    const web = layoutElement(
      button,
      matchText(button.text, button.weight, button.fontSize, ctxp(allReady)),
      4000,
      resolverMixed,
    );
    expect(web.lines).toHaveLength(1);
    expect(sys.lines).toHaveLength(1);
    expect(web.width).toBeGreaterThan(sys.width);
  });

  it('存在某个容器宽度：系统字体单行、web 字体到达后变成两行（复现换行）', () => {
    let found = -1;
    for (let w = 180; w <= 520; w += 1) {
      const sys = layoutElement(
        button,
        matchText(button.text, button.weight, button.fontSize, ctxp([])),
        w,
        resolverSys,
      );
      const web = layoutElement(
        button,
        matchText(button.text, button.weight, button.fontSize, ctxp(allReady)),
        w,
        resolverMixed,
      );
      if (sys.lines.length === 1 && web.lines.length === 2) {
        found = w;
        break;
      }
    }
    expect(found).toBeGreaterThan(0);
  });

  it('行高由主导字体度量决定：新字体行高更紧', () => {
    const sys = layoutElement(
      button,
      matchText(button.text, button.weight, button.fontSize, ctxp([])),
      4000,
      resolverSys,
    );
    const web = layoutElement(
      button,
      matchText(button.text, button.weight, button.fontSize, ctxp(allReady)),
      4000,
      resolverMixed,
    );
    expect(web.height).toBeCloseTo(16 * 1.14, 5);
    expect(sys.height).toBeCloseTo(16 * 1.2, 5);
    expect(web.height).toBeLessThan(sys.height);
  });

  it('breakAfter 与行区间一致（CJK 走 PingFang 回退行高）', () => {
    const text = '全新可变字体系统';
    const snap = layoutElement(
      { id: 'h', label: '标题', kind: 'heading', text, weight: 700, fontSize: 38 },
      matchText(text, 700, 38, ctxp(allReady)),
      150,
      (fileId) => (fileId ? v2.files.find((f) => f.id === fileId)!.metrics : v2.fallbacks[4].metrics),
    );
    expect(snap.breakAfter).toHaveLength(snap.lines.length - 1);
    expect(snap.height).toBeCloseTo(snap.lines.length * 38 * 1.35, 0);
  });
});
