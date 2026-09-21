import type { AcceptanceRecord, ClsThresholds, SimulationResult } from './types';

export const DEFAULT_THRESHOLDS: ClsThresholds = {
  // 仿真度量口径（视口高 600px 的 impact fraction），0.3 对应明显但可接受的一次重排
  maxCls: 0.3,
  maxMissingGlyphs: 0,
  maxStableMs: 3000,
};

export interface Verdict {
  passed: boolean;
  checks: Array<{
    id: 'cls' | 'missing' | 'stable' | 'firstChange';
    label: string;
    ok: boolean;
    detail: string;
  }>;
}

export function evaluate(result: SimulationResult, thresholds: ClsThresholds): Verdict {
  const missing = result.missingGlyphs.length;
  const checks = [
    {
      id: 'cls' as const,
      label: '累计布局偏移 CLS',
      ok: result.finalCls <= thresholds.maxCls,
      detail: `${result.finalCls.toFixed(4)}（门槛 ≤ ${thresholds.maxCls}）`,
    },
    {
      id: 'missing' as const,
      label: '缺失字形',
      ok: missing <= thresholds.maxMissingGlyphs,
      detail:
        missing === 0
          ? '无缺字'
          : `${missing} 个缺字：${[...new Set(result.missingGlyphs.map((m) => m.char))].slice(0, 8).join(' ')}`,
    },
    {
      id: 'stable' as const,
      label: '字体稳定时间',
      ok: result.stableAt <= thresholds.maxStableMs,
      detail: `${result.stableAt}ms（门槛 ≤ ${thresholds.maxStableMs}ms）`,
    },
    {
      id: 'firstChange' as const,
      label: '首次视觉变化',
      ok: result.firstVisualChangeAt >= 0,
      detail:
        result.firstVisualChangeAt >= 0
          ? `发生在 ${result.firstVisualChangeAt}ms（第 ${result.firstVisualChangeFrame + 1} 帧）`
          : '全程无视觉变化（首屏即最终态）',
    },
  ];
  return { passed: checks.every((c) => c.ok), checks };
}

export function buildRecord(input: {
  scenarioName: string;
  versionName: string;
  language: string;
  containerWidth: number;
  result: SimulationResult;
  thresholds: ClsThresholds;
  notes?: string;
}): AcceptanceRecord {
  const verdict = evaluate(input.result, input.thresholds);
  const final = input.result.frames.at(-1);
  return {
    id: `rec-${input.result.fingerprint}-${input.result.stableAt}`,
    createdAt: new Date().toISOString(),
    scenarioName: input.scenarioName,
    versionName: input.versionName,
    language: input.language,
    containerWidth: input.containerWidth,
    passed: verdict.passed,
    thresholds: input.thresholds,
    metrics: {
      finalCls: Number(input.result.finalCls.toFixed(4)),
      firstVisualChangeAt: input.result.firstVisualChangeAt,
      stableAt: input.result.stableAt,
      missingCount: input.result.missingGlyphs.length,
      lineCountMax: Math.max(1, ...(final?.elements ?? []).map((e) => e.lineCount)),
      familiesUsed: [...new Set((final?.elements ?? []).flatMap((e) => e.familiesUsed))],
    },
    notes: input.notes,
  };
}
