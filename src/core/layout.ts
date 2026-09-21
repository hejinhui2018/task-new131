// 排版布局：字符前进宽度 → 换行点 → 行盒子 / 元素几何
import type {
  CharMatch,
  ElementSnapshot,
  LayoutLine,
  SampleText,
} from './types';
import { charWidth } from './matcher';
import type { FontMetrics } from './types';

/** 取一组字符匹配中“主导字体”的行高度量（出现最多的来源） */
export function dominantMetrics(
  chars: CharMatch[],
  resolve: (fileId: string | null, family: string) => FontMetrics,
): FontMetrics {
  const tally = new Map<string, number>();
  for (const c of chars) {
    if (c.char === '\n') continue;
    const key = `${c.source}:${c.fileId ?? c.family}`;
    tally.set(key, (tally.get(key) ?? 0) + 1);
  }
  let bestKey = '';
  let bestN = -1;
  for (const [k, n] of tally) {
    if (n > bestN) {
      bestKey = k;
      bestN = n;
    }
  }
  const [source, id] = bestKey.split(':');
  return resolve(source === 'web' ? id : null, source === 'web' ? '' : id);
}

/**
 * 贪心换行：按空格断词（CJK 字符允许任意断点）。
 * 返回每行的 [start, end) 字符区间。
 */
export function wrapLines(
  text: string,
  widths: number[],
  containerWidth: number,
): Array<[number, number]> {
  const codePoints = Array.from(text);
  const lines: Array<[number, number]> = [];
  let lineStart = 0;
  let lineWidth = 0;
  let i = 0;

  const pushLine = (end: number) => {
    lines.push([lineStart, end]);
    lineStart = end;
    lineWidth = 0;
  };

  while (i < codePoints.length) {
    const ch = codePoints[i];
    if (ch === '\n') {
      pushLine(i + 1);
      i++;
      continue;
    }
    const w = widths[i] ?? 0;

    // 单个字符（CJK）超宽：先断行再放置
    if (lineWidth + w > containerWidth && lineStart < i && canBreakBefore(codePoints, i)) {
      // 回退到上一个断点
      const br = lastBreakOpportunity(codePoints, lineStart, i);
      if (br > lineStart) {
        pushLine(br);
        // 跳过断点后的空格
        if (codePoints[br] === ' ') {
          lineStart = br + 1;
          i = Math.max(i, lineStart);
        }
        continue;
      }
    }

    lineWidth += w;
    i++;

    if (lineWidth > containerWidth) {
      // 超宽：优先在词间断行
      const br = lastBreakOpportunity(codePoints, lineStart, i);
      if (br > lineStart) {
        pushLine(br);
        if (codePoints[br] === ' ') {
          lineStart = br + 1;
          i = Math.max(i, lineStart);
        }
      } else if (canBreakBefore(codePoints, i - 1)) {
        // CJK：直接在字符间断行
        pushLine(i - 1);
      }
      // 极端长单词：允许溢出本行（真实 CSS 也会溢出）
    }
  }
  if (lineStart < codePoints.length || lines.length === 0) {
    lines.push([lineStart, codePoints.length]);
  }
  return lines;
}

/** i 之前是否允许断行：空格后、或前一字符为 CJK 可断字符 */
function canBreakBefore(chars: string[], i: number): boolean {
  if (i <= 0) return false;
  const prev = chars[i - 1];
  if (prev === ' ') return true;
  return isBreakableCjk(prev);
}

function isBreakableCjk(ch: string): boolean {
  const cp = ch.codePointAt(0) ?? 0;
  return (
    (cp >= 0x2e80 && cp <= 0x9fff) ||
    (cp >= 0xac00 && cp <= 0xd7af) ||
    (cp >= 0xf900 && cp <= 0xfaff)
  );
}

/** 区间内最后一个断行机会位置（断点落在空格本身 / CJK 字符之后） */
function lastBreakOpportunity(chars: string[], start: number, end: number): number {
  for (let i = end; i > start; i--) {
    if (chars[i - 1] === ' ') return i - 1; // 在空格处断开，空格随上一行
    if (isBreakableCjk(chars[i - 1])) return i;
  }
  return start;
}

/** 行高 px：用主导字体行高系数 */
export function lineHeightPx(fontSize: number, m: FontMetrics): number {
  return fontSize * m.lineHeight;
}

/** 由逐字符匹配生成元素快照 */
export function layoutElement(
  sample: SampleText,
  chars: CharMatch[],
  containerWidth: number,
  metricsResolver: (fileId: string | null, family: string) => FontMetrics,
): ElementSnapshot {
  const widths = chars.map((c) => c.width);
  const ranges = wrapLines(sample.text, widths, containerWidth);
  const cp = Array.from(sample.text);
  const m = dominantMetrics(chars, metricsResolver);
  const lh = lineHeightPx(sample.fontSize, m);

  const lines: LayoutLine[] = ranges.map(([start, end]) => {
    const slice = cp.slice(start, end).join('');
    let width = 0;
    for (let i = start; i < end; i++) width += widths[i] ?? 0;
    return { start, end, text: slice.replace(/\n$/, ''), width, height: lh };
  });

  const width = lines.reduce((mx, l) => Math.max(mx, l.width), 0);
  const height = lines.length * lh;
  const breakAfter = ranges.slice(0, -1).map(([, end]) => end - 1);

  return {
    textId: sample.id,
    label: sample.label,
    kind: sample.kind,
    weight: sample.weight,
    fontSize: sample.fontSize,
    chars,
    lines,
    width,
    height,
    breakAfter,
  };
}

/** 仅用于测试 / 预估：给定度量直接算单字符宽度 */
export function widthWith(
  ch: string,
  fontSize: number,
  m: FontMetrics,
  weight = 400,
): number {
  return charWidth(ch, fontSize, m, weight);
}
