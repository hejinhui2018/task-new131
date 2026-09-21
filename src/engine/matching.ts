import type {
  FallbackFamily,
  FontSource,
  FontStyle,
  ReleaseConfig,
} from './types';
import { covers } from './subsets';

const GENERIC = new Set(['serif', 'sans-serif', 'monospace']);
/** 通用族永远可用，宽度系数 1（作为相对基准） */
export const GENERIC_FACTOR = 1;

export interface AvailableState {
  loadedSources: Set<string>;
  failedSources: Set<string>;
  loadedFallbacks: Set<string>;
}

export interface MatchedFace {
  kind: 'source' | 'fallback' | 'generic';
  family: string;
  source?: FontSource;
  fallback?: FallbackFamily;
  usedWeight: number;
  factor: number;
  lineHeightFactor: number;
  variable: boolean;
  /** 未找到任何覆盖字形的族时为 true（.notdef / tofu） */
  missing: boolean;
}

export function isVariable(s: FontSource): boolean {
  return s.variable === true || Array.isArray(s.weight);
}

export function weightRange(s: FontSource): [number, number] {
  return Array.isArray(s.weight) ? s.weight : [s.weight, s.weight];
}

/**
 * 按 CSS Fonts 4 的字重匹配规则对候选 face 排序。
 * 可变字体在 [min,max] 区间内视为“精确包含”请求值（优先命中）。
 */
export function orderFacesByWeight(faces: FontSource[], desired: number): FontSource[] {
  if (faces.length <= 1) return faces.slice();

  // 1. 静态精确字重优先
  const exactStatic = faces.find(
    (f) => !Array.isArray(f.weight) && f.weight === desired,
  );
  if (exactStatic) return [exactStatic, ...faces.filter((f) => f !== exactStatic)];

  // 2. 区间覆盖请求值的可变字体
  const variableContaining = faces.find(
    (f) => isVariable(f) && desired >= weightRange(f)[0] && desired <= weightRange(f)[1],
  );
  if (variableContaining) {
    return [variableContaining, ...faces.filter((f) => f !== variableContaining)];
  }

  // 3. 距离最近（desired≥400 时倾向更粗，<400 时倾向更细，近似 CSS 规则）
  const score = (f: FontSource): number => {
    const [lo, hi] = weightRange(f);
    const nearest = desired < (lo + hi) / 2 ? lo : hi;
    let d = Math.abs(nearest - desired);
    if (desired >= 400 && nearest > desired) d -= 0.5;
    if (desired < 400 && nearest < desired) d -= 0.5;
    return d;
  };
  return faces.slice().sort((a, b) => score(a) - score(b));
}

function faceCovers(s: FontSource, cp: number): boolean {
  return covers(s.subsets, s.extraRanges, cp);
}

/** 当前可用的 brand source（同族、已加载未失败） */
function availableSourcesFor(
  config: ReleaseConfig,
  family: string,
  state: AvailableState,
): FontSource[] {
  return config.sources.filter(
    (s) =>
      s.family === family &&
      state.loadedSources.has(s.id) &&
      !state.failedSources.has(s.id),
  );
}

/**
 * 逐字形解析：按 font-family 栈顺序，对每个族做
 * “已加载 → 字重/样式匹配 → 字形覆盖”，未覆盖则继续下一族（字形级回退）。
 * 全部不覆盖时返回 missing（.notdef）。
 */
export function resolveGlyph(
  cp: number,
  weight: number,
  _style: FontStyle,
  config: ReleaseConfig,
  state: AvailableState,
): MatchedFace {
  let firstReadyFace: MatchedFace | null = null;

  for (const name of config.stack) {
    // 1) brand family 的 @font-face
    const faces = availableSourcesFor(config, name, state);
    if (faces.length > 0) {
      const ordered = orderFacesByWeight(faces, weight);
      for (const s of ordered) {
        const match: MatchedFace = {
          kind: 'source',
          family: name,
          source: s,
          usedWeight: clampWeight(s, weight),
          factor: s.widthFactor,
          lineHeightFactor: s.lineHeightFactor,
          variable: isVariable(s),
          missing: false,
        };
        if (!firstReadyFace) firstReadyFace = match;
        if (faceCovers(s, cp)) return match;
      }
      // 该族有可用 face 但不含此字形 → 逐字形回退到栈中下一个族
      continue;
    }

    // 2) 具名回退族
    const fb = config.fallbacks.find((f) => f.family === name);
    if (fb) {
      const fbReady = fb.system || state.loadedFallbacks.has(fb.id);
      if (fbReady) {
        const match: MatchedFace = {
          kind: 'fallback',
          family: fb.family,
          fallback: fb,
          usedWeight: weight,
          factor: fb.widthFactor,
          lineHeightFactor: fb.lineHeightFactor,
          variable: false,
          missing: false,
        };
        if (!firstReadyFace) firstReadyFace = match;
        const covered = fb.coverage ? covers([], fb.coverage, cp) : true;
        if (covered) return match;
        continue;
      }
      continue; // 回退 web 字体尚未加载 → 跳过
    }

    // 3) 通用族关键字（serif / sans-serif / monospace）
    if (GENERIC.has(name)) {
      const match: MatchedFace = {
        kind: 'generic',
        family: name,
        usedWeight: weight,
        factor: GENERIC_FACTOR,
        lineHeightFactor: 1,
        variable: false,
        missing: false,
      };
      if (!firstReadyFace) firstReadyFace = match;
      return match;
    }
  }

  // 没有任何族覆盖该码点 → .notdef（豆腐块），借用首个就绪族的度量
  if (firstReadyFace) return { ...firstReadyFace, missing: true };
  return {
    kind: 'generic',
    family: 'sans-serif',
    usedWeight: weight,
    factor: GENERIC_FACTOR,
    lineHeightFactor: 1,
    variable: false,
    missing: true,
  };
}

export function clampWeight(s: FontSource, desired: number): number {
  if (Array.isArray(s.weight)) {
    const [lo, hi] = s.weight;
    return Math.min(hi, Math.max(lo, desired));
  }
  return s.weight;
}
