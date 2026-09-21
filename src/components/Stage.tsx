// 渲染舞台：逐字符着色 + 用仿真宽度精确复现换行
import type { ElementSnapshot, LayoutShift } from '../core/types';

interface StageProps {
  elements: ElementSnapshot[];
  containerWidth: number;
  /** 当前步骤发生的偏移事件 */
  shifts: LayoutShift[];
  /** 对比模式下要高亮的字符：textId -> 下标集合 */
  highlightChars?: Record<string, Set<number>>;
  title?: string;
  dimmed?: boolean;
}

export function Stage({
  elements,
  containerWidth,
  shifts,
  highlightChars,
  title,
  dimmed,
}: StageProps) {
  const shiftByText = new Map(shifts.map((s) => [s.textId, s]));
  return (
    <div className="stage-canvas" style={{ opacity: dimmed ? 0.55 : 1 }}>
      <span className="ruler">容器 {containerWidth}px</span>
      <div
        style={{
          width: `${containerWidth}px`,
          maxWidth: '100%',
          margin: '10px auto 4px',
          position: 'relative',
        }}
      >
        {title && (
          <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 10 }}>
            {title}
          </div>
        )}
        {elements.map((el) => (
          <ElementView
            key={el.textId}
            el={el}
            shift={shiftByText.get(el.textId)}
            highlight={highlightChars?.[el.textId]}
          />
        ))}
        <div
          className="width-marker"
          style={{ width: `${Math.min(containerWidth, 9999)}px`, maxWidth: 'calc(100% - 0px)' }}
          title={`容器宽度 ${containerWidth}px`}
        />
      </div>
    </div>
  );
}

function ElementView({
  el,
  shift,
  highlight,
}: {
  el: ElementSnapshot;
  shift?: LayoutShift;
  highlight?: Set<number>;
}) {
  return (
    <div className="element-card" style={{ marginBottom: 22 }}>
      <div className="element-tag">
        <span>{el.label}</span>
        <span>
          {el.kind} · {el.fontSize}px / wght {el.weight}
        </span>
        <span>
          {el.width.toFixed(0)}×{el.height.toFixed(0)}px · {el.lines.length} 行
        </span>
        {shift && (
          <span className={`shift-badge${shift.deltaHeight === 0 && shift.deltaLines === 0 ? ' neutral' : ''}`}>
            {shift.reason}
            {shift.deltaLines !== 0 && ` · 行${shift.deltaLines > 0 ? '+' : ''}${shift.deltaLines}`}
            {shift.deltaHeight !== 0 && ` · 高${shift.deltaHeight > 0 ? '+' : ''}${shift.deltaHeight}px`}
          </span>
        )}
      </div>
      {el.lines.map((line, li) => (
        <div
          key={li}
          className="el-line"
          style={{ height: `${line.height}px`, lineHeight: `${line.height}px` }}
        >
          {Array.from({ length: line.end - line.start }, (_, k) => {
            const idx = line.start + k;
            const c = el.chars[idx];
            if (!c) return null;
            const cls = [
              'glyph',
              c.missing ? 'missing' : c.source === 'web' ? 'web' : 'system',
              c.weightSynthesized ? 'synth' : '',
              highlight?.has(idx) ? 'diff-mark' : '',
            ]
              .filter(Boolean)
              .join(' ');
            const familyTip =
              c.source === 'web'
                ? `web 字体 ${c.family}（${c.fileId}）`
                : `系统回退 ${c.family}${c.missing ? ' · 缺失字形 .notdef' : ''}`;
            return (
              <span
                key={idx}
                className={cls}
                title={familyTip}
                style={{
                  display: 'inline-block',
                  width: `${c.width}px`,
                  height: `${line.height}px`,
                  lineHeight: `${line.height}px`,
                  whiteSpace: 'pre',
                  overflow: 'hidden',
                  verticalAlign: 'top',
                  fontSize: `${el.fontSize}px`,
                  fontFamily: c.source === 'system' ? c.family : undefined,
                }}
              >
                {c.char === ' ' ? ' ' : c.char}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}
