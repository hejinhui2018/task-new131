// FontRelay 引擎：把加载事件串成时间线，逐步生成匹配 / 布局快照与 CLS
import type {
  ElementSnapshot,
  FontConfig,
  FontMetrics,
  InjectionRecord,
  LayoutShift,
  LoadConditions,
  RunParams,
  RunResult,
  TimelineStep,
} from './types';
import { LANGUAGES } from './presets';
import { FontCache, planLoads } from './loader';
import { layoutElement } from './layout';
import { countFallback, matchText } from './matcher';
import { fileCoverage, subsetMap } from './coverage';

/** 仿真视口面积（CLS 归一用，对应 1280×720 CSS px） */
export const VIEWPORT_AREA = 1280 * 720;

function metricsResolverFor(config: FontConfig) {
  const byId = new Map(config.files.map((f) => [f.id, f.metrics]));
  const byFamily = new Map(config.fallbacks.map((f) => [f.family, f.metrics]));
  return (fileId: string | null, family: string): FontMetrics => {
    if (fileId && byId.has(fileId)) return byId.get(fileId)!;
    return byFamily.get(family) ?? config.fallbacks[config.fallbacks.length - 1].metrics;
  };
}

function renderAll(params: RunParams, readyFileIds: Set<string>): ElementSnapshot[] {
  const { config, conditions, containerWidth, languageId } = params;
  const lang = LANGUAGES.find((l) => l.id === languageId) ?? LANGUAGES[0];
  const resolve = metricsResolverFor(config);
  const missingOverride = new Set(conditions.missingGlyphs);
  return lang.texts.map((sample) => {
    const chars = matchText(sample.text, sample.weight, sample.fontSize, {
      config,
      readyFileIds,
      missingOverride,
    });
    return layoutElement(sample, chars, containerWidth, resolve);
  });
}

/** 相邻两步骤间的布局偏移事件 */
export function diffShifts(
  prev: ElementSnapshot[],
  next: ElementSnapshot[],
  t: number,
): LayoutShift[] {
  const shifts: LayoutShift[] = [];
  for (let i = 0; i < next.length; i++) {
    const a = prev[i];
    const b = next[i];
    if (!a) continue;
    const fontChangedChars: number[] = [];
    for (let c = 0; c < b.chars.length; c++) {
      if (a.chars[c]?.family !== b.chars[c]?.family || a.chars[c]?.fileId !== b.chars[c]?.fileId) {
        fontChangedChars.push(c);
      }
    }
    const dH = b.height - a.height;
    const dW = b.width - a.width;
    const dLines = b.lines.length - a.lines.length;
    if (dH === 0 && dW === 0 && fontChangedChars.length === 0) continue;

    // 偏移分数 ≈ 受影响面积 / 视口面积（高度变化推动下方内容）
    const movedArea = Math.abs(dH) * 960 + Math.abs(dW) * 48;
    const score = Math.min(0.25, movedArea / VIEWPORT_AREA);
    const reasonParts: string[] = [];
    if (dLines > 0) reasonParts.push('出现新增换行');
    else if (dLines < 0) reasonParts.push('换行收回');
    if (fontChangedChars.length) reasonParts.push(`${fontChangedChars.length} 个字符切换字体`);
    if (dH === 0 && dLines === 0 && fontChangedChars.length) {
      reasonParts[0] = '字体切换但几何未变';
    }
    shifts.push({
      t,
      textId: b.textId,
      label: b.label,
      deltaHeight: round1(dH),
      deltaWidth: round1(dW),
      deltaLines: dLines,
      affectedChars: fontChangedChars.length,
      score: round4(score),
      reason: reasonParts.join('，') || '几何变化',
    });
  }
  return shifts;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/** 执行一次完整运行，生成逐步时间线 */
export function runRelay(params: RunParams, cache?: FontCache): RunResult {
  const { config, conditions } = params;
  const effectiveCache = cache ?? new FontCache(conditions.cachedUrls);

  // 缓存里已有的 URL 对应文件在 t=0 就绪（缓存命中场景 / 刷新恢复）
  const cachedReady = new Set(
    config.files.filter((f) => effectiveCache.has(f.url)).map((f) => f.id),
  );

  const { events, injections } = planLoads(config.files, mergeCacheConditions(conditions, effectiveCache));

  const steps: TimelineStep[] = [];
  const shifts: LayoutShift[] = [];
  const ready = new Set<string>(cachedReady);

  // t=0：首屏（FOIT 不可见期也按系统回退首帧建模——真实浏览器先绘制回退字体）
  const initial = renderAll(params, ready);
  const cacheHitIds = config.files.filter((f) => effectiveCache.has(f.url)).map((f) => f.id);
  steps.push({
    t: 0,
    type: 'init',
    readyFileIds: [...ready],
    elements: initial,
    note: '首屏：web 字体尚未到达，以系统回退字体绘制（FOUT 首帧）',
  });

  if (cacheHitIds.length) {
    steps.push({
      t: 0,
      type: 'cache-hit',
      readyFileIds: [...ready],
      elements: cloneElements(initial),
      note: `缓存命中：${cacheHitIds.length} 个文件在运行开始前已就绪（${cacheHitIds
        .map((id) => labelOf(config, id))
        .join('、')}），首屏直接使用`,
    });
  }

  // 按时间排序加载事件（同刻按 load 先于 fail 不稳定，无需特殊处理）
  const sorted = [...events].sort((a, b) => a.t - b.t || a.fileId.localeCompare(b.fileId));
  let prevElements = initial;

  for (const ev of sorted) {
    // 缓存命中事件（t=0 且已在 ready 集合）跳过重复步骤
    if (ev.type === 'load' && ready.has(ev.fileId)) continue;

    if (ev.type === 'fail') {
      steps.push({
        t: ev.t,
        type: 'fail',
        fileId: ev.fileId,
        url: ev.url,
        readyFileIds: [...ready],
        elements: cloneElements(prevElements),
        note: `文件加载失败：${labelOf(config, ev.fileId)}，相关字符继续使用回退字体`,
      });
      continue;
    }

    ready.add(ev.fileId);
    effectiveCache.add(ev.url);
    const elements = renderAll(params, ready);
    const at = diffShifts(prevElements, elements, ev.t);
    shifts.push(...at);
    steps.push({
      t: ev.t,
      type: 'load',
      fileId: ev.fileId,
      url: ev.url,
      readyFileIds: [...ready],
      elements,
      note: `字体文件到达：${labelOf(config, ev.fileId)}`,
    });
    prevElements = elements;
  }

  // 重复注入步骤（合并为一条提示步骤，位置在注入完成时刻；不改变渲染）
  const redundant = injections.filter((i) => i.redundant);
  if (redundant.length) {
    steps.push({
      t: 0,
      type: 'dup-inject',
      readyFileIds: [...ready],
      elements: cloneElements(prevElements),
      note: `检测到 ${redundant.length} 次重复 @font-face/link 注入（浏览器去重，不产生额外请求）`,
    });
  }

  const settleT = sorted.length ? Math.max(...sorted.map((e) => e.t)) : 0;
  steps.push({
    t: settleT,
    type: 'settle',
    readyFileIds: [...ready],
    elements: cloneElements(prevElements),
    note: '字体稳定（settled）：所有未失败文件已应用',
  });
  // 让时间线严格按 t 排序（dup-inject t=0 放到 init 之后）
  steps.sort((a, b) => a.t - b.t);
  reorderSpecialSteps(steps);

  const failedFiles = events.filter((e) => e.type === 'fail').map((e) => e.fileId);
  const cls = round4(shifts.reduce((sum, s) => sum + s.score, 0));

  return {
    steps,
    settledStepIndex: steps.findIndex((s) => s.type === 'settle'),
    shifts,
    injections,
    failedFiles,
    fellBackChars: countFallbackOf(prevElements),
    cls,
  };
}

/** 刷新后二次运行：缓存条件与显式条件合并 */
function mergeCacheConditions(conditions: LoadConditions, cache: FontCache): LoadConditions {
  return {
    ...conditions,
    cachedUrls: Array.from(new Set([...conditions.cachedUrls, ...cache.values()])),
  };
}

function reorderSpecialSteps(steps: TimelineStep[]): void {
  // init 必须第一，settle 必须最后；dup-inject 紧跟 init
  const init = steps.findIndex((s) => s.type === 'init');
  if (init > 0) {
    const [s] = steps.splice(init, 1);
    steps.unshift(s);
  }
  const dup = steps.findIndex((s) => s.type === 'dup-inject');
  if (dup > 1) {
    const [s] = steps.splice(dup, 1);
    steps.splice(1, 0, s);
  }
  const settleIdx = steps.findIndex((s) => s.type === 'settle');
  if (settleIdx >= 0 && settleIdx !== steps.length - 1) {
    const [s] = steps.splice(settleIdx, 1);
    steps.push(s);
  }
}

function countFallbackOf(elements: ElementSnapshot[]): number {
  return elements.reduce((n, el) => n + countFallback(el.chars), 0);
}

function labelOf(config: FontConfig, fileId: string): string {
  return config.files.find((f) => f.id === fileId)?.label ?? fileId;
}

function cloneElements(elements: ElementSnapshot[]): ElementSnapshot[] {
  return elements.map((e) => ({ ...e, chars: e.chars.map((c) => ({ ...c })), lines: [...e.lines], breakAfter: [...e.breakAfter] }));
}

/** 哪些字符因“缺字故障”会受影响（供 UI 提示） */
export function declaredButMissing(config: FontConfig, text: string, forcedMissing: Set<string>): string[] {
  const subsets = subsetMap(config);
  const out = new Set<string>();
  for (const ch of Array.from(text)) {
    if (!forcedMissing.has(ch)) continue;
    for (const f of config.files) {
      if (fileCoverage(f, subsets).has(ch)) {
        out.add(ch);
        break;
      }
    }
  }
  return [...out];
}

/** 汇总注入统计 */
export function injectionStats(injections: InjectionRecord[]): { total: number; redundant: number } {
  return { total: injections.length, redundant: injections.filter((i) => i.redundant).length };
}
