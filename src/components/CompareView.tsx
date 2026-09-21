// A/B 版本对比：双舞台同步步进，高亮字体差异字符，定位第一次视觉变化
import type { RunResult, VersionCompare } from '../core/types';
import { Stage } from './Stage';

interface Props {
  runA: RunResult;
  runB: RunResult;
  nameA: string;
  nameB: string;
  compare: VersionCompare;
  stepIndex: number;
  containerWidth: number;
  onSeekFirst: () => void;
}

export function CompareView({
  runA,
  runB,
  nameA,
  nameB,
  compare,
  stepIndex,
  containerWidth,
  onSeekFirst,
}: Props) {
  const stepA = runA.steps[Math.min(stepIndex, runA.steps.length - 1)];
  const stepB = runB.steps[Math.min(stepIndex, runB.steps.length - 1)];
  const diff = compare.steps[Math.min(stepIndex, compare.steps.length - 1)];
  const shiftsAt = (run: RunResult, t: number) => run.shifts.filter((s) => s.t === t);

  const highlight: Record<string, Set<number>> = {};
  for (const e of diff?.elements ?? []) {
    if (e.fontChangedChars.length) highlight[e.textId] = new Set(e.fontChangedChars);
  }
  const isFirstStep = stepIndex === compare.firstVisualStepIndex;

  return (
    <div className="stage-col">
      {compare.firstVisualChangeAt === null ? (
        <div className="no-change-banner">✓ 两个版本逐步渲染一致，没有检测到视觉变化。</div>
      ) : (
        <div className="first-change-banner">
          {isFirstStep ? '▶ 这里是第一次视觉变化！' : '首次视觉变化定位：'}
          t = {compare.firstVisualChangeAt}ms（第 {compare.firstVisualStepIndex! + 1} 步）
          <button className="tiny" style={{ marginLeft: 10 }} onClick={onSeekFirst}>
            {isFirstStep ? '已定位' : '跳到该步骤'}
          </button>
          <span style={{ marginLeft: 12, color: 'var(--text-dim)' }}>
            稳定态：Δ总高 {compare.settledHeightDelta}px · ΔCLS {compare.settledClsDelta.toFixed(4)} ·
            Δ回退字符 {compare.settledFallbackDelta}
          </span>
        </div>
      )}
      <div className="stage-wrap">
        <div className="stage-col">
          <h3 style={{ margin: 0 }}>A · {nameA}</h3>
          <Stage
            elements={stepA.elements}
            containerWidth={containerWidth}
            shifts={shiftsAt(runA, stepA.t)}
            highlightChars={highlight}
            title={`${stepA.type} · ${stepA.t}ms`}
          />
        </div>
        <div className="stage-col">
          <h3 style={{ margin: 0 }}>B · {nameB}</h3>
          <Stage
            elements={stepB.elements}
            containerWidth={containerWidth}
            shifts={shiftsAt(runB, stepB.t)}
            highlightChars={highlight}
            title={`${stepB.type} · ${stepB.t}ms`}
          />
        </div>
      </div>
    </div>
  );
}
