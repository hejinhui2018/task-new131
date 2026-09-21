import type { ElementLayoutSnapshot, FrameSnapshot, Scenario, StageElementSpec } from '../engine/types';
import { contentWidth, stackRects } from '../engine/metrics';

/** family → 稳定颜色（相同名称永远同色，便于跨帧比对） */
export function familyColor(family: string): string {
  const palette = [
    '#3b4fe4', '#0a7ea4', '#16794c', '#9a6700', '#b3261e',
    '#8250df', '#bf3989', '#57606a', '#0969da', '#a40e26',
  ];
  let h = 0;
  for (let i = 0; i < family.length; i++) h = (h * 31 + family.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

const ELEMENT_KIND_CLASS: Record<StageElementSpec['kind'], string> = {
  title: 'el-title',
  body: 'el-body',
  button: 'el-button',
};

function ElementView({
  spec,
  snap,
  scenario,
  shifted,
  shiftText,
}: {
  spec: StageElementSpec;
  snap: ElementLayoutSnapshot;
  scenario: Scenario;
  shifted: boolean;
  shiftText?: string;
}) {
  const lineHeight = scenario.fontSize * scenario.lineHeightRatio;
  const avail = contentWidth(spec, scenario);

  return (
    <div
      className={ELEMENT_KIND_CLASS[spec.kind]}
      style={{
        width: snap.width,
        minHeight: snap.height,
        paddingLeft: spec.paddingX ?? 0,
        paddingRight: spec.paddingX ?? 0,
        fontSize: scenario.fontSize * (spec.kind === 'title' ? 1.5 : 1),
        fontWeight: spec.weight ?? scenario.config.requestedWeight,
        fontStyle: spec.style ?? scenario.config.requestedStyle,
        position: 'relative',
      }}
    >
      <span className="el-tag">{spec.kind} · {snap.lineCount} 行 · {Math.round(snap.width)}×{Math.round(snap.height)}</span>
      {shifted && <span className="shift-badge">布局变化{shiftText ? ` ${shiftText}` : ''}</span>}
      {snap.lines.map((line, li) => (
        <div
          key={li}
          style={{
            height: lineHeight,
            width: spec.kind === 'button' ? Math.max(line.width, avail - 0) : '100%',
            whiteSpace: 'pre',
            overflow: 'hidden',
          }}
        >
          {line.glyphs.map((g, gi) => (
            <span
              key={gi}
              className={`glyph ${g.invisible ? 'invisible' : ''} ${g.missing ? 'missing' : ''}`}
              title={`${g.char === ' ' ? '空格' : g.char} U+${g.codePoint.toString(16).toUpperCase().padStart(4, '0')} · ${g.family} · wght ${g.usedWeight} · ${g.width.toFixed(1)}px${g.missing ? ' · 缺字' : ''}`}
              style={{
                width: g.width,
                color: g.missing ? undefined : familyColor(g.family),
                lineHeight: `${lineHeight * g.factor}px`,
              }}
            >
              {g.missing ? '□' : g.char}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

export function Stage({
  scenario,
  frame,
  prevFrame,
}: {
  scenario: Scenario;
  frame: FrameSnapshot;
  prevFrame?: FrameSnapshot;
}) {
  const rects = stackRects(frame.elements);
  const prevRects = new Map((prevFrame ? stackRects(prevFrame.elements) : []).map((r) => [r.elementId, r]));
  const specById = new Map(scenario.elements.map((e) => [e.id, e]));
  const stageHeight = Math.max(...rects.map((r) => r.y + r.height), 0) + 24;
  const families = [...new Set(frame.elements.flatMap((e) => e.familiesUsed))];

  return (
    <div>
      <div className="legend" style={{ marginBottom: 8 }}>
        {families.map((f) => (
          <span key={f}>
            <i className="dot" style={{ background: familyColor(f) }} />
            {f}
          </span>
        ))}
        <span><i className="dot" style={{ background: 'var(--bad)' }} />缺字 .notdef</span>
        <span className="muted">灰色虚位 = block 隐形期文字</span>
      </div>
      <div className="stage-wrap">
        <div
          className="stage"
          style={{ width: scenario.containerWidth, height: stageHeight }}
          data-testid="stage"
        >
          {rects.map((r) => {
            const spec = specById.get(r.elementId)!;
            const snap = frame.elements.find((e) => e.elementId === r.elementId)!;
            const pr = prevRects.get(r.elementId);
            const shifted = !!pr && (pr.y !== r.y || Math.abs(pr.height - r.height) > 0.5 || Math.abs(pr.width - r.width) > 0.5);
            const parts: string[] = [];
            if (pr && Math.abs(pr.height - r.height) > 0.5) parts.push(`高${r.height - pr.height > 0 ? '+' : ''}${Math.round(r.height - pr.height)}`);
            if (pr && pr.y !== r.y) parts.push(`y${r.y - pr.y > 0 ? '+' : ''}${Math.round(r.y - pr.y)}`);
            if (pr && Math.abs(pr.width - r.width) > 0.5) parts.push(`宽${r.width - pr.width > 0 ? '+' : ''}${Math.round(r.width - pr.width)}`);
            return (
              <div key={r.elementId} className="el-box" style={{ left: 0, top: r.y, width: r.width }}>
                <ElementView spec={spec} snap={snap} scenario={scenario} shifted={shifted} shiftText={parts.join(' ')} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
