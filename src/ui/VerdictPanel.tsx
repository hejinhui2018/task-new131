import type { ClsThresholds, SimulationResult } from '../engine/types';
import { evaluate } from '../engine/acceptance';
import { Section } from './primitives';

export function VerdictPanel({
  result,
  thresholds,
  onThreshold,
}: {
  result: SimulationResult;
  thresholds: ClsThresholds;
  onThreshold: (patch: Partial<ClsThresholds>) => void;
}) {
  const verdict = evaluate(result, thresholds);
  return (
    <Section title="验收判定">
      <div className="row" style={{ marginBottom: 8 }}>
        <span className={`big-num ${verdict.passed ? 'ok' : 'bad'}`}>
          {verdict.passed ? '通过' : '未通过'}
        </span>
        <span className="spacer" />
        <label className="field">CLS ≤
          <input type="number" step={0.05} value={thresholds.maxCls} onChange={(e) => onThreshold({ maxCls: Number(e.target.value) })} />
        </label>
        <label className="field">稳定 ≤ ms
          <input type="number" step={100} value={thresholds.maxStableMs} onChange={(e) => onThreshold({ maxStableMs: Number(e.target.value) })} />
        </label>
      </div>
      <div className="verdict">
        {verdict.checks.map((c) => (
          <div key={c.id} className={`check ${c.ok ? 'ok' : 'bad'}`}>
            <span className="mark">{c.ok ? '✓' : '✗'}</span>
            <span style={{ flex: 1 }}>{c.label}</span>
            <span className="muted">{c.detail}</span>
          </div>
        ))}
      </div>
      {result.duplicateInjections.length > 0 && (
        <p style={{ color: 'var(--warn)', fontSize: 11, marginTop: 8 }}>
          ⚠ 检测到重复注入 {result.duplicateInjections.map((d) => `${d.family}×${d.times}`).join('，')}（仿真已按 URL 去重，仅 1 次请求）
        </p>
      )}
    </Section>
  );
}
