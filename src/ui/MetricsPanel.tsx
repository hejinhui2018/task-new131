import { useMemo, useState } from 'react';
import type { FrameSnapshot, SimulationResult } from '../engine/types';
import { familyColor } from './Stage';
import { Section, Badge } from './primitives';

export function MetricsPanel({ result, frame }: { result: SimulationResult; frame: FrameSnapshot }) {
  const [selected, setSelected] = useState<string>('all');
  const elements = frame.elements;
  const shown = selected === 'all' ? elements : elements.filter((e) => e.elementId === selected);

  const glyphRows = useMemo(
    () =>
      shown.flatMap((e) =>
        e.lines.flatMap((l) =>
          l.glyphs.map((g) => ({ elementId: e.elementId, ...g })),
        ),
      ),
    [shown],
  );

  const missingNow = glyphRows.filter((g) => g.missing);
  const families = [...new Set(glyphRows.map((g) => g.family))];

  return (
    <Section title="逐帧度量 · 字形匹配">
      <div className="row" style={{ marginBottom: 6 }}>
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="all">全部元素</option>
          {elements.map((e) => (
            <option key={e.elementId} value={e.elementId}>{e.elementId}</option>
          ))}
        </select>
        <Badge tone={frame.clsDelta > 0 ? 'warn' : 'ok'}>本帧 CLS {frame.clsDelta.toFixed(4)}</Badge>
        <Badge tone={result.finalCls > 0 ? 'warn' : 'ok'}>累计 {frame.cls.toFixed(4)}</Badge>
      </div>

      <table className="metrics">
        <thead>
          <tr>
            <th>元素</th>
            <th className="num">行</th>
            <th className="num">宽</th>
            <th className="num">高</th>
            <th className="num">缺字</th>
            <th>字体</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((e) => (
            <tr key={e.elementId}>
              <td>{e.elementId}</td>
              <td className="num">{e.lineCount}</td>
              <td className="num">{Math.round(e.width)}</td>
              <td className="num">{Math.round(e.height)}</td>
              <td className="num" style={{ color: e.missingCount ? 'var(--bad)' : undefined }}>{e.missingCount}</td>
              <td>
                {e.familiesUsed.map((f) => (
                  <span key={f} style={{ color: familyColor(f), marginRight: 4, whiteSpace: 'nowrap' }}>●{f}</span>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>字形明细（前 60 个）</h3>
      <div style={{ maxHeight: 230, overflowY: 'auto', border: '1px solid var(--line-2)', borderRadius: 6 }}>
        <table className="metrics">
          <thead>
            <tr><th>字</th><th>码点</th><th>字体</th><th className="num">wght</th><th className="num">宽px</th><th></th></tr>
          </thead>
          <tbody>
            {glyphRows.slice(0, 60).map((g, i) => (
              <tr key={i} style={{ opacity: g.invisible ? 0.4 : 1 }}>
                <td className="mono" style={{ fontSize: 14 }}>{g.invisible ? '·' : g.missing ? '□' : g.char === ' ' ? '␠' : g.char}</td>
                <td className="mono">U+{g.codePoint.toString(16).toUpperCase().padStart(4, '0')}</td>
                <td style={{ color: g.missing ? 'var(--bad)' : familyColor(g.family) }}>
                  {g.family}
                  {g.invisible && <span className="muted"> (隐形)</span>}
                </td>
                <td className="num">{g.usedWeight}</td>
                <td className="num">{g.width.toFixed(1)}</td>
                <td>{g.missing ? <Badge tone="bad">缺字</Badge> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ fontSize: 11, margin: '4px 0 0' }}>
        共 {glyphRows.length} 字形；{missingNow.length} 个缺字；{families.length} 个字体族。
      </p>
    </Section>
  );
}
