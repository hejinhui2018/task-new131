import type {
  FrameSnapshot,
  LoadCondition,
  ReleaseConfig,
  Scenario,
  SimulationResult,
  TimelineEvent,
} from './types';
import { layoutElement, stackRects, type RenderContext } from './metrics';
import { covers } from './subsets';
import type { AvailableState } from './matching';

interface Settle {
  kind: 'source' | 'fallback';
  id: string;
  family: string;
  time: number;
  outcome: 'loaded' | 'failed';
}

const VIEWPORT_HEIGHT = 600;

/** font-display 各阶段时长（ms），采用 Chromium 风格默认值 */
export function displayPeriods(config: ReleaseConfig): { block: number; swap: number } {
  switch (config.display) {
    case 'block':
      return { block: config.blockPeriodMs || 3000, swap: Infinity };
    case 'swap':
      return { block: config.blockPeriodMs || 100, swap: Infinity };
    case 'fallback':
      return { block: config.blockPeriodMs || 100, swap: config.swapPeriodMs || 3000 };
    case 'optional':
      return { block: config.blockPeriodMs || 100, swap: 0 };
    case 'auto':
    default:
      return { block: config.blockPeriodMs || 3000, swap: Infinity };
  }
}

function effectiveLoadMs(base: number, condition: LoadCondition, cached: boolean): number {
  if (cached) return 0;
  return Math.round(base * condition.slowdownFactor);
}

function planSettles(scenario: Scenario): Settle[] {
  const { config, condition } = scenario;
  const settles: Settle[] = [];
  for (const s of config.sources) {
    const cached = condition.cacheHitSourceIds.includes(s.id);
    settles.push({
      kind: 'source',
      id: s.id,
      family: s.family,
      time: cached ? 0 : effectiveLoadMs(s.loadMs, condition, cached),
      outcome: cached ? 'loaded' : s.fail || condition.networkDown ? 'failed' : 'loaded',
    });
  }
  for (const f of config.fallbacks) {
    if (f.system) continue;
    settles.push({
      kind: 'fallback',
      id: f.id,
      family: f.family,
      time: Math.round((f.loadMs ?? 0) * condition.slowdownFactor),
      outcome: f.fail || condition.networkDown ? 'failed' : 'loaded',
    });
  }
  return settles;
}

function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export interface Planner {
  scenario: Scenario;
  settles: Settle[];
  blockEnd: number;
  /** swap 窗口结束时刻（Infinity=永久可换） */
  allowUntil: number;
  /** 字体状态不再变化的时刻 */
  stableAt: number;
  frameAt(t: number): Omit<FrameSnapshot, 'clsDelta' | 'cls' | 'changedFromFirst'>;
}

function createPlanner(scenario: Scenario): Planner {
  const { config } = scenario;
  const periods = displayPeriods(config);
  const blockEnd = periods.block;
  const allowUntil = periods.swap === Infinity ? Infinity : blockEnd + periods.swap;
  const settles = planSettles(scenario);
  const settleOf = new Map(settles.map((s) => [`${s.kind}:${s.id}`, s]));

  const usableAt = (s: Settle, t: number): boolean =>
    s.outcome === 'loaded' && s.time <= t && (allowUntil === Infinity || s.time <= allowUntil);

  const buildState = (t: number): AvailableState => {
    const loadedSources = new Set<string>();
    const failedSources = new Set<string>();
    const loadedFallbacks = new Set<string>();
    for (const s of settles) {
      if (s.kind === 'source') {
        if (usableAt(s, t)) loadedSources.add(s.id);
        else if (s.outcome === 'failed' && s.time <= t) failedSources.add(s.id);
      } else if (s.outcome === 'loaded' && s.time <= t) {
        loadedFallbacks.add(s.id);
      }
    }
    return { loadedSources, failedSources, loadedFallbacks };
  };

  const brandSourcesForCp = (cp: number) =>
    config.sources.filter(
      (s) => config.stack.includes(s.family) && covers(s.subsets, s.extraRanges, cp),
    );

  const makeCtx = (t: number): RenderContext => ({
    state: buildState(t),
    t,
    blockEnd,
    isBrandPending: (cp: number) => {
      if (t >= blockEnd) return false;
      return brandSourcesForCp(cp).some((s) => settleOf.get(`source:${s.id}`)!.time > t);
    },
    isBrandSuppressed: (cp: number) => {
      if (allowUntil === Infinity) return false;
      return brandSourcesForCp(cp).every((s) => {
        const st = settleOf.get(`source:${s.id}`)!;
        return !(st.outcome === 'loaded' && st.time <= allowUntil);
      });
    },
  });

  // 稳定时刻：加载成功取 min(落地, 窗口结束)，失败取失败时刻
  const stableAt = Math.max(
    blockEnd,
    ...settles.map((s) =>
      s.outcome === 'loaded'
        ? allowUntil === Infinity
          ? s.time
          : Math.min(s.time, allowUntil)
        : s.time,
    ),
  );

  return {
    scenario,
    settles,
    blockEnd,
    allowUntil,
    stableAt,
    frameAt(t: number) {
      const ctx = makeCtx(t);
      const elements = scenario.elements.map((el) => layoutElement(el, scenario, ctx));
      const phase: FrameSnapshot['phase'] =
        t < blockEnd ? 'block' : t >= stableAt ? 'stable' : 'swap';
      return {
        t,
        phase,
        loadedSources: [...ctx.state.loadedSources],
        failedSources: [...ctx.state.failedSources],
        loadedFallbacks: [...ctx.state.loadedFallbacks],
        elements,
      };
    },
  };
}

/** 帧的视觉签名：用于“第一次视觉变化”与版本逐帧对比 */
export function frameSignature(
  frame: Pick<FrameSnapshot, 'elements'>,
): string {
  return JSON.stringify(
    frame.elements.map((e) => ({
      id: e.elementId,
      lines: e.lines.map((l) =>
        l.glyphs
          .map((g) => `${g.family[0]}${g.missing ? 'x' : ''}${g.invisible ? '_' : ''}@${g.width.toFixed(1)}`)
          .join('|'),
      ),
      w: Math.round(e.width),
      h: Math.round(e.height),
    })),
  );
}

/** 计算两帧之间的 CLS 增量（impact fraction：变动区域 / 视口） */
export function clsDeltaBetween(
  prev: Pick<FrameSnapshot, 'elements'>,
  next: Pick<FrameSnapshot, 'elements'>,
  containerWidth: number,
): number {
  const a = new Map(stackRects(prev.elements).map((r) => [r.elementId, r]));
  const b = new Map(stackRects(next.elements).map((r) => [r.elementId, r]));
  const viewport = Math.max(1, containerWidth * VIEWPORT_HEIGHT);
  let impacted = 0;
  for (const [id, rb] of b) {
    const ra = a.get(id);
    if (!ra) {
      impacted += rb.width * rb.height;
      continue;
    }
    if (ra.x === rb.x && ra.y === rb.y && ra.width === rb.width && ra.height === rb.height) {
      continue;
    }
    const x0 = Math.min(ra.x, rb.x);
    const y0 = Math.min(ra.y, rb.y);
    const x1 = Math.max(ra.x + ra.width, rb.x + rb.width);
    const y1 = Math.max(ra.y + ra.height, rb.y + rb.height);
    impacted += (x1 - x0) * (y1 - y0);
  }
  return impacted / viewport;
}

/** 导出规划器：供 A/B 在共享时间轴上取帧 */
export function plannerFor(scenario: Scenario): Planner {
  return createPlanner(scenario);
}

export interface RunOptions {
  /** 第几次重复运行（>=2 时追加 repeat-run 事件） */
  runIndex?: number;
}

/** 执行一次字体加载模拟，返回逐帧时间线。纯函数：相同输入永远产生相同输出。 */
export function simulate(scenario: Scenario, opts: RunOptions = {}): SimulationResult {
  const planner = createPlanner(scenario);
  const { config, condition } = scenario;
  const { settles, blockEnd, allowUntil, stableAt } = planner;
  const events: TimelineEvent[] = [];
  const push = (e: TimelineEvent) => events.push(e);

  // ---- t=0 事件 ----
  push({ t: 0, kind: 'first-paint', message: '首屏绘制：使用当前可用字体（缓存 / 系统回退 / 隐形期）' });
  for (const s of settles) {
    if (s.kind === 'source') {
      const src = config.sources.find((x) => x.id === s.id)!;
      const cached = condition.cacheHitSourceIds.includes(s.id);
      if (cached) {
        push({ t: 0, kind: 'cache-hit', family: s.family, sourceId: s.id, message: `${s.family} 命中缓存，立即可用` });
      } else {
        push({
          t: 0,
          kind: 'load-start',
          family: s.family,
          sourceId: s.id,
          message: `开始请求 ${s.family}（预计 ${s.time}ms${src.fail || condition.networkDown ? '，将失败' : ''}）`,
        });
      }
      const times = src.injections ?? 1;
      if (times > 1) {
        push({
          t: 0,
          kind: 'duplicate-injection',
          family: s.family,
          sourceId: s.id,
          message: `检测到 @font-face 重复注入：${s.family} 被注入 ${times} 次（浏览器按 URL 去重，仅发起 1 次请求）`,
        });
      }
    } else {
      push({ t: 0, kind: 'load-start', family: s.family, message: `开始请求回退字体 ${s.family}` });
    }
  }
  if (opts.runIndex && opts.runIndex > 1) {
    push({ t: 0, kind: 'repeat-run', message: `第 ${opts.runIndex} 次重复运行（结果应与首次一致）` });
  }

  // ---- 帧时间点 ----
  const timeSet = new Set<number>([0]);
  for (const s of settles) timeSet.add(s.time);
  if (blockEnd > 0) timeSet.add(blockEnd);
  if (allowUntil !== Infinity && allowUntil > 0) timeSet.add(allowUntil);
  timeSet.add(stableAt);
  const frameTimes = [...timeSet].filter((t) => Number.isFinite(t) && t >= 0).sort((a, b) => a - b);

  // ---- 落定事件 ----
  for (const s of settles) {
    if (s.time === 0) continue;
    if (s.kind === 'source') {
      if (s.outcome === 'loaded') {
        const suppressed = allowUntil !== Infinity && s.time > allowUntil;
        push({
          t: s.time,
          kind: suppressed ? 'stable' : 'font-load',
          family: s.family,
          sourceId: s.id,
          message: suppressed
            ? `${s.family} 加载完成（${s.time}ms），但已错过 ${config.display} 窗口，页面不会替换字体`
            : `${s.family} 加载完成（${s.time}ms），触发字体替换`,
        });
      } else {
        push({ t: s.time, kind: 'font-fail', family: s.family, sourceId: s.id, message: `${s.family} 加载失败（${s.time}ms），保持回退字体` });
      }
    } else if (s.outcome === 'loaded') {
      push({ t: s.time, kind: 'fallback-load', family: s.family, message: `回退字体 ${s.family} 加载完成（${s.time}ms）` });
    } else {
      push({ t: s.time, kind: 'font-fail', family: s.family, message: `回退字体 ${s.family} 加载失败（${s.time}ms）` });
    }
  }
  if (blockEnd > 0) {
    push({ t: blockEnd, kind: 'block-end', message: 'block 期结束：隐形文字改用回退字体显示' + (allowUntil === Infinity ? '（仍可继续 swap）' : '') });
  }
  if (allowUntil !== Infinity && allowUntil > 0) {
    push({
      t: allowUntil,
      kind: 'stable',
      message:
        config.display === 'optional'
          ? `${config.display}：未在窗口内就绪的字体被永久放弃`
          : `${config.display} swap 期结束：未就绪的字体被永久放弃`,
    });
  }
  push({ t: stableAt, kind: 'stable', message: `字体状态稳定（${stableAt}ms）` });

  // ---- 逐帧布局 ----
  const frames: FrameSnapshot[] = [];
  let firstSig = '';
  let firstVisualChangeFrame = -1;
  let firstVisualChangeAt = -1;
  let cls = 0;

  for (const t of frameTimes) {
    const base = planner.frameAt(t);
    const frame: FrameSnapshot = {
      ...base,
      clsDelta: 0,
      cls: 0,
      changedFromFirst: false,
    };
    if (frames.length > 0) {
      const delta = clsDeltaBetween(frames[frames.length - 1], frame, scenario.containerWidth);
      frame.clsDelta = delta;
      cls += delta;
    }
    frame.cls = cls;

    const sig = frameSignature(frame);
    if (frames.length === 0) {
      firstSig = sig;
    } else {
      frame.changedFromFirst = sig !== firstSig;
      if (frame.changedFromFirst && firstVisualChangeFrame === -1) {
        firstVisualChangeFrame = frames.length;
        firstVisualChangeAt = t;
        push({ t, kind: 'swap', message: '第一次视觉变化：字形字体 / 尺寸 / 换行与首屏不同' });
      }
    }
    frames.push(frame);
  }

  const last = frames[frames.length - 1];
  if (last) last.phase = 'stable';
  events.sort((a, b) => a.t - b.t || a.kind.localeCompare(b.kind));

  const finalFrame = frames[frames.length - 1];
  const missingGlyphs = (finalFrame?.elements ?? []).flatMap((e) =>
    e.lines.flatMap((l) =>
      l.glyphs
        .filter((g) => g.missing)
        .map((g) => ({ elementId: e.elementId, char: g.char, codePoint: g.codePoint, family: g.family })),
    ),
  );

  const duplicateInjections = config.sources
    .filter((s) => (s.injections ?? 1) > 1)
    .map((s) => ({ sourceId: s.id, family: s.family, times: s.injections ?? 1 }));

  // 指纹只刻画视觉与加载结果；repeat-run 是运行标记，不参与指纹
  const fingerprintInput = JSON.stringify({
    v: 1,
    final: finalFrame ? frameSignature(finalFrame) : '',
    events: events
      .filter((e) => e.kind !== 'repeat-run')
      .map((e) => `${e.t}:${e.kind}:${e.sourceId ?? ''}`),
  });

  return {
    frames,
    events,
    firstVisualChangeFrame,
    firstVisualChangeAt,
    finalCls: cls,
    stableAt,
    missingGlyphs,
    duplicateInjections,
    fingerprint: fnv1a(fingerprintInput),
  };
}

/** 重复运行 N 次：验证“重复运行结果一致”（重复注入等回归场景） */
export function simulateRepeated(scenario: Scenario, times = 2): SimulationResult[] {
  const out: SimulationResult[] = [];
  for (let i = 0; i < times; i++) out.push(simulate(scenario, { runIndex: i + 1 }));
  return out;
}

export interface VersionDiff {
  aName: string;
  bName: string;
  /** 共享时间轴上第一次出现差异的时刻 */
  firstDifferingFrame: number;
  firstDifferingAt: number;
  finalClsA: number;
  finalClsB: number;
  stableA: number;
  stableB: number;
  firstChangeA: number;
  firstChangeB: number;
  missingA: number;
  missingB: number;
  perElement: Array<{
    elementId: string;
    lineA: number;
    lineB: number;
    heightA: number;
    heightB: number;
    familiesA: string[];
    familiesB: string[];
    missingA: number;
    missingB: number;
    changed: boolean;
  }>;
}

/**
 * 在两个版本的共享时间轴上逐点对比，定位第一次视觉出现差异的时刻。
 * 元素按下标配对（同一批文案，不同发布版本）。
 */
export function diffVersions(
  scenarioA: Scenario,
  scenarioB: Scenario,
  a: SimulationResult,
  b: SimulationResult,
  aName: string,
  bName: string,
): VersionDiff {
  const pa = createPlanner(scenarioA);
  const pb = createPlanner(scenarioB);
  const grid = new Set<number>([0]);
  for (const p of [pa, pb]) {
    grid.add(p.blockEnd);
    if (p.allowUntil !== Infinity) grid.add(p.allowUntil);
    grid.add(p.stableAt);
    for (const s of p.settles) grid.add(s.time);
  }
  const times = [...grid].filter(Number.isFinite).sort((x, y) => x - y);

  let firstDifferingFrame = -1;
  let firstDifferingAt = -1;
  times.forEach((t, i) => {
    const sigA = frameSignature(pa.frameAt(t));
    const sigB = frameSignature(pb.frameAt(t));
    if (firstDifferingFrame === -1 && sigA !== sigB) {
      firstDifferingFrame = i;
      firstDifferingAt = t;
    }
  });

  const ea = a.frames.at(-1)!.elements;
  const eb = b.frames.at(-1)!.elements;
  const n = Math.max(ea.length, eb.length);
  const perElement = Array.from({ length: n }, (_, i) => {
    const x = ea[i];
    const y = eb[i];
    return {
      elementId: x?.elementId ?? y.elementId,
      lineA: x?.lineCount ?? 0,
      lineB: y?.lineCount ?? 0,
      heightA: Math.round(x?.height ?? 0),
      heightB: Math.round(y?.height ?? 0),
      familiesA: x?.familiesUsed ?? [],
      familiesB: y?.familiesUsed ?? [],
      missingA: x?.missingCount ?? 0,
      missingB: y?.missingCount ?? 0,
      changed:
        (x?.lineCount ?? 0) !== (y?.lineCount ?? 0) ||
        Math.round(x?.height ?? 0) !== Math.round(y?.height ?? 0) ||
        (x?.missingCount ?? 0) !== (y?.missingCount ?? 0) ||
        JSON.stringify(x?.familiesUsed ?? []) !== JSON.stringify(y?.familiesUsed ?? []),
    };
  });

  return {
    aName,
    bName,
    firstDifferingFrame,
    firstDifferingAt,
    finalClsA: a.finalCls,
    finalClsB: b.finalCls,
    stableA: a.stableAt,
    stableB: b.stableAt,
    firstChangeA: a.firstVisualChangeAt,
    firstChangeB: b.firstVisualChangeAt,
    missingA: a.missingGlyphs.length,
    missingB: b.missingGlyphs.length,
    perElement,
  };
}
