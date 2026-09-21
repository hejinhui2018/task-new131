// 字体匹配与回退：复刻浏览器逐字符沿字体栈查找字形的过程
import type {
  CharMatch,
  FallbackFont,
  FontConfig,
  FontFile,
  FontMetrics,
} from './types';
import { fileCoverage, isFullWidth, subsetMap } from './coverage';

/** 请求字重在轴上的实际取值与是否合成 */
export function resolveAxisWeight(
  file: FontFile,
  desired: number,
): { weight: number; synthesized: boolean } {
  if (file.variable) {
    if (desired < file.axis.min || desired > file.axis.max) {
      return { weight: clamp(desired, file.axis.min, file.axis.max), synthesized: true };
    }
    return { weight: desired, synthesized: false };
  }
  // 静态字体：只有一个实例，任何其它字重都靠浏览器合成（faux bold）
  return { weight: file.axis.default, synthesized: desired !== file.axis.default };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** 字符前进宽度 px（简化字体度量模型） */
export function charWidth(
  ch: string,
  fontSize: number,
  metrics: FontMetrics,
  weight: number,
  defaultWeight = 400,
): number {
  if (ch === '\n') return 0;
  const base = isFullWidth(ch) ? 1.0 : metrics.advance;
  const weightEffect = 1 + metrics.weightWidth * ((weight - defaultWeight) / 100);
  // 空格略窄，标点略窄
  const tweak = ch === ' ' ? 0.8 : /[.,:;!?'")/]/.test(ch) ? 0.55 : 1;
  return fontSize * base * weightEffect * tweak;
}

export interface MatchContext {
  config: FontConfig;
  /** 当前已就绪可用的 web 文件 id */
  readyFileIds: Set<string>;
  /** 即使声明覆盖也视为缺字的字符 */
  missingOverride: Set<string>;
}

/** 挑选能渲染该字符、且已就绪的 web 文件 */
function pickWebFile(
  ctx: MatchContext,
  ch: string,
  weight: number,
): { file: FontFile; weight: number; synthesized: boolean } | null {
  const subsets = subsetMap(ctx.config);
  // 候选：覆盖该字符的已就绪文件；静态字体优先选字重最接近的
  const candidates: { file: FontFile; score: number }[] = [];
  for (const file of ctx.config.files) {
    if (!ctx.readyFileIds.has(file.id)) continue;
    const coverage = fileCoverage(file, subsets);
    if (!coverage.has(ch)) continue;
    if (ctx.missingOverride.has(ch)) continue; // 故障：文件里这个字形损坏 / 缺失
    const { weight: w } = resolveAxisWeight(file, weight);
    const score = file.variable ? 0 : Math.abs(w - weight);
    candidates.push({ file, score });
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => a.score - b.score);
  const file = candidates[0].file;
  const r = resolveAxisWeight(file, weight);
  return { file, weight: r.weight, synthesized: r.synthesized };
}

/** 在系统回退链里找第一个覆盖该字符的字体 */
function pickFallback(
  fallbacks: FallbackFont[],
  ch: string,
  missingOverride: Set<string>,
): { fallback: FallbackFont; missing: boolean } {
  for (const fb of fallbacks) {
    if (fb.coverage === '') return { fallback: fb, missing: true }; // 兜底 .notdef
    if (fb.coverage.includes(ch)) {
      // 系统字体本身不会因为“子集”缺字，除非故障注入显式声明
      return { fallback: fb, missing: missingOverride.has(ch) };
    }
  }
  // 理论上不会到这里（链尾有空覆盖兜底）
  const last = fallbacks[fallbacks.length - 1];
  return { fallback: last, missing: true };
}

/** 逐字符匹配整段文本 */
export function matchText(
  text: string,
  weight: number,
  fontSize: number,
  ctx: MatchContext,
): CharMatch[] {
  const chars = Array.from(text);
  return chars.map((ch, index) => {
    if (ch === '\n') {
      return {
        index,
        char: ch,
        family: ctx.config.family,
        fileId: null,
        source: 'system' as const,
        missing: false,
        weightSynthesized: false,
        width: 0,
      };
    }
    const web = pickWebFile(ctx, ch, weight);
    if (web) {
      return {
        index,
        char: ch,
        family: web.file.family,
        fileId: web.file.id,
        source: 'web',
        missing: false,
        weightSynthesized: web.synthesized,
        width: charWidth(ch, fontSize, web.file.metrics, web.weight),
      };
    }
    const { fallback, missing } = pickFallback(
      ctx.config.fallbacks,
      ch,
      ctx.missingOverride,
    );
    return {
      index,
      char: ch,
      family: fallback.family,
      fileId: null,
      source: 'system',
      missing,
      weightSynthesized: false,
      width: charWidth(ch, fontSize, fallback.metrics, weight),
    };
  });
}

/** 统计落在系统字体的字符数（含缺字） */
export function countFallback(chars: CharMatch[]): number {
  return chars.filter((c) => c.source === 'system' && c.char !== '\n').length;
}
