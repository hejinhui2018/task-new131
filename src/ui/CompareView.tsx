import { useMemo, useState } from 'react';
import type { Scenario, SimulationResult } from '../engine/types';
import { diffVersions, plannerFor } from '../engine/simulation';
import { Stage } from './Stage';
import { Badge } from './primitives';

export function CompareView({
  scenarioA,
  scenarioB,
  resultA,
  resultB,
}: {
  scenarioA: Scenario;
  scenarioB: Scenario;
  resultA: SimulationResult;
  resultB: SimulationResult;
}) {
  const pa = useMemo(() => plannerFor(scenarioA), [scenarioA]);
  const pb = useMemo(() => plannerFor(scenarioB), [scenarioB]);
  const diff = useMemo(
    () => diffVersions(scenarioA, scenarioB, resultA, resultB, scenarioA.config.versionName, scenarioB.config.versionName),
    [scenarioA, scenarioB, resultA, resultB],
  );

  const grid = useMemo(() => {
    const s = new Set<number>([0]);
    for (const p of [pa, pb]) {
      s.add(p.blockEnd);
      if (p.allowUntil !== Infinity) s.add(p.allowUntil);
      s.add(p.stableAt);
      for (const x of p.settles) s.add(x.time);
    }
    return [...s].filter(Number.isFinite).sort((a, b) => a - b);
  }, [pa, pb]);

  const [idx, setIdx] = useState(0);
  const safeIdx = Math.min(idx, grid.length - 1);
  const t = grid[safeIdx];
  const frameA = fullFrame(pa.frameAt(t), resultA);
  const frameB = fullFrame(pb.frameAt(t), resultB);

  return (
    <div>
      <div className="panel" style={{ marginBottom: 10 }}>
        <h2>版本对比 · 共享时间轴</h2>
        <div className="row">
          <button className="tiny" disabled={safeIdx === 0} onClick={() => setIdx((i) => i - 1)}>←</button>
          <input
            type="range"
            min={0}
            max={grid.length - 1}
            value={safeIdx}
            onChange={(e) => setIdx(Number(e.target.value))}
            style={{ flex: 1 }}
          />
          <button className="tiny" disabled={safeIdx === grid.length - 1} onClick={() => setIdx((i) => i + 1)}>→</button>
          <span className="mono">t = {t}ms（{safeIdx + 1}/{grid.length}）</span>
        </div>
        <div className="row" style={{ marginTop: 6 }}>
          <Badge tone={diff.firstDifferingAt >= 0 ? 'warn' : 'ok'}>
            第一次版本差异：{diff.firstDifferingAt >= 0 ? `${diff.firstDifferingAt}ms` : '无差异'}
          </Badge>
          <span className="muted">
            CLS {diff.finalClsA.toFixed(3)} → {diff.finalClsB.toFixed(3)} ·
            首变 {diff.firstChangeA < 0 ? '—' : diff.firstChangeA + 'ms'} → {diff.firstChangeB < 0 ? '—' : diff.firstChangeB + 'ms'} ·
            稳定 {diff.stableA} → {diff.stableB}ms ·
            缺字 {diff.missingA} → {diff.missingB}
          </span>
        </div>
        <table className="metrics" style={{ marginTop: 6 }}>
          <thead>
            <tr><th>元素</th><th className="num">行 A</th><th className="num">行 B</th><th className="num">高 A</th><th className="num">高 B</th><th>缺字 A→B</th><th>最终字体差异</th></tr>
          </thead>
          <tbody>
            {diff.perElement.map((p) => (
              <tr key={p.elementId} style={{ background: p.changed ? 'var(--warn-bg)' : undefined }}>
                <td>{p.elementId}</td>
                <td className="num">{p.lineA}</td>
                <td className="num">{p.lineB}</td>
                <td className="num">{p.heightA}</td>
                <td className="num">{p.heightB}</td>
                <td className="num">{p.missingA} → {p.missingB}</td>
                <td style={{ fontSize: 10.5 }}>
                  {p.familiesA.join('/')} → {p.familiesB.join('/')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div className="panel">
          <h2>A · {scenarioA.config.versionName}</h2>
          <Stage scenario={scenarioA} frame={frameA} />
        </div>
        <div className="panel">
          <h2>B · {scenarioB.config.versionName}</h2>
          <Stage scenario={scenarioB} frame={frameB} />
        </div>
      </div>
    </div>
  );
}

/** planner.frameAt 不含 cls 字段，Stage 只需要 elements，这里补齐类型 */
function fullFrame(f: ReturnType<ReturnType<typeof plannerFor>['frameAt']>, _r: SimulationResult) {
  return { ...f, clsDelta: 0, cls: 0, changedFromFirst: false };
}
