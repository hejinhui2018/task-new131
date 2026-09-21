import type {
  ElementLayoutSnapshot,
  GlyphMatch,
  Scenario,
  StageElementSpec,
} from './types';
import { resolveGlyph, type AvailableState, type MatchedFace } from './matching';

/**
 * 确定性伪度量：不同字体（widthFactor）+ 码点形状决定 advance width。
 * 不使用随机数，保证重复运行结果完全一致（可验收、可比对）。
 */

// 全角 / CJK
function isCjk(cp: number): boolean {
  return (
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0x3000 && cp <= 0x303f) ||
    (cp >= 0xff00 && cp <= 0xffef)
  );
}

function isSpace(cp: number): boolean {
  return cp === 0x20 || cp === 0x3000;
}

/** 码点基础字宽（em），拉丁字母有确定性宽窄差异 */
function baseAdvanceEm(ch: string, cp: number, weight: number): number {
  if (isSpace(cp)) return cp === 0x3000 ? 1 : 0.28;
  if (isCjk(cp)) return 1;
  // 确定性哈希 0..1
  const h = ((cp * 2654435761) >>> 0) / 4294967296;
  let em = 0.44 + h * 0.16; // 0.44 ~ 0.60
  if (ch === ch.toUpperCase() && ch !== ch.toLowerCase()) em += 0.06;
  // 字重对字宽的微小影响（可变轴变化也会引起细微位移）
  em *= 1 + (weight - 400) * 0.00004;
  return em;
}

export interface RenderContext {
  state: AvailableState;
  /** 当前时间（用于诊断） */
  t: number;
  /** block 期结束时刻；t < blockEnd 时未就绪的首选字形不可见但占回退宽度 */
  blockEnd: number;
  /** 判定某码点的首选 brand face 是否仍在加载（用于 block 不可见） */
  isBrandPending: (cp: number, weight: number) => boolean;
  /** 该码点是否永远不使用 brand（display:optional/fallback 错过窗口） */
  isBrandSuppressed: (cp: number) => boolean;
}

export interface RenderedGlyph extends GlyphMatch {
  /** block 期内不可见（隐形回退字体，占位但不显示字形） */
  invisible: boolean;
}

function renderGlyph(
  ch: string,
  cp: number,
  el: StageElementSpec,
  scenario: Scenario,
  ctx: RenderContext,
): RenderedGlyph {
  const weight = el.weight ?? scenario.config.requestedWeight;
  const style = el.style ?? scenario.config.requestedStyle;
  const face: MatchedFace = resolveGlyph(cp, weight, style, scenario.config, ctx.state);
  const invisible =
    ctx.t < ctx.blockEnd && !face.source && ctx.isBrandPending(cp, weight) && !ctx.isBrandSuppressed(cp);
  const em = baseAdvanceEm(ch, cp, face.usedWeight);
  return {
    char: ch,
    codePoint: cp,
    family: face.family,
    sourceId: face.source?.id,
    fallbackId: face.fallback?.id,
    missing: face.missing,
    usedWeight: face.usedWeight,
    factor: face.factor,
    width: scenario.fontSize * em * face.factor,
    invisible,
  };
}

/** CJK 标点不允许出现在行首（简易禁则） */
const NO_LINE_START = new Set(
  '，。！？、：；）】》」』”’…·.,!?;:)]}%€',
);

export function contentWidth(el: StageElementSpec, scenario: Scenario): number {
  const limit = el.maxWidth !== undefined
    ? Math.min(el.maxWidth, scenario.containerWidth)
    : scenario.containerWidth;
  return Math.max(8, limit - (el.paddingX ?? 0) * 2);
}

/**
 * 贪心换行：拉丁语按空格分词，CJK 逐字可断行。
 */
export function layoutElement(
  el: StageElementSpec,
  scenario: Scenario,
  ctx: RenderContext,
): ElementLayoutSnapshot {
  const avail = contentWidth(el, scenario);
  const glyphs: RenderedGlyph[] = [];
  for (const ch of el.text) {
    const cp = ch.codePointAt(0)!;
    glyphs.push(renderGlyph(ch, cp, el, scenario, ctx));
  }

  const lines: RenderedGlyph[][] = [[]];
  let lineWidth = 0;

  const pushBreak = (g: RenderedGlyph) => {
    lines.push([g]);
    lineWidth = g.width;
  };

  for (let i = 0; i < glyphs.length; i++) {
    const g = glyphs[i];
    const cur = lines[lines.length - 1];

    if (g.char === '\n') {
      lines.push([]);
      lineWidth = 0;
      continue;
    }

    if (isSpace(g.codePoint)) {
      // 行首折叠空格；否则仅当放得下时保留
      if (cur.length === 0) continue;
      if (lineWidth + g.width <= avail) {
        cur.push(g);
        lineWidth += g.width;
      } else {
        lines.push([]);
        lineWidth = 0;
      }
      continue;
    }

    if (cur.length > 0 && lineWidth + g.width > avail) {
      const cjkBreakable = isCjk(g.codePoint) && !NO_LINE_START.has(g.char);
      const prevSpace = cur[cur.length - 1] && isSpace(cur[cur.length - 1].codePoint);
      if (cjkBreakable || prevSpace) {
        if (prevSpace) cur.pop();
        pushBreak(g);
        continue;
      }
      // 拉丁语长词：若上一个断点是空格，在空格后断开
      let lastSpace = -1;
      for (let k = cur.length - 1; k >= 0; k--) {
        if (isSpace(cur[k].codePoint)) {
          lastSpace = k;
          break;
        }
      }
      if (lastSpace > 0) {
        const moved = cur.splice(lastSpace + 1);
        cur.length = lastSpace; // 去掉行尾空格
        lines.push(moved);
        lineWidth = moved.reduce((s, x) => s + x.width, 0);
        if (lineWidth + g.width <= avail) {
          lines[lines.length - 1].push(g);
          lineWidth += g.width;
        } else {
          pushBreak(g);
        }
        continue;
      }
      // 单个超长词：溢出也不断字（保留宽度，标红由 UI 提示）
      cur.push(g);
      lineWidth += g.width;
    } else {
      cur.push(g);
      lineWidth += g.width;
    }
  }

  const nonEmpty = lines.filter((l) => l.length > 0);
  const laidLines = nonEmpty.map((line, idx) => ({
    glyphs: line,
    width: line.reduce((s, g) => s + g.width, 0),
    wrapped: idx < nonEmpty.length - 1,
  }));

  // 按钮 shrink-to-fit：外宽 = min(maxWidth, 最长行宽 + padding)
  const maxLine = Math.max(0, ...laidLines.map((l) => l.width));
  const padding = (el.paddingX ?? 0) * 2;
  const outerWidth =
    el.kind === 'button'
      ? Math.min(el.maxWidth ?? scenario.containerWidth, maxLine + padding)
      : scenario.containerWidth;

  const lineHeight = scenario.fontSize * scenario.lineHeightRatio;
  // 行高受该行内最高的字体系数影响（隐形回退字形也算 —— 这正是 swap 位移来源之一）
  const height = laidLines.reduce((h, l) => {
    const f = Math.max(1, ...l.glyphs.map((g) => g.factor));
    return h + lineHeight * f;
  }, 0);

  const missing: RenderedGlyph[] = [];
  const fam: string[] = [];
  for (const g of laidLines.flatMap((l) => l.glyphs)) {
    if (g.missing) missing.push(g);
    if (!fam.includes(g.family)) fam.push(g.family);
  }

  return {
    elementId: el.id,
    lines: laidLines,
    width: outerWidth,
    height,
    lineCount: laidLines.length,
    missingCount: missing.length,
    familiesUsed: fam,
  };
}

export interface ElementRect {
  elementId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 纵向堆叠元素，返回各元素矩形（用于 CLS 计算） */
export function stackRects(snapshots: ElementLayoutSnapshot[], gap = 12): ElementRect[] {
  const rects: ElementRect[] = [];
  let y = 0;
  for (const s of snapshots) {
    rects.push({ elementId: s.elementId, x: 0, y, width: s.width, height: s.height });
    y += s.height + gap;
  }
  return rects;
}
