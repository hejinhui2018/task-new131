// 当前步骤的逐字符匹配检查器
import type { ElementSnapshot } from '../core/types';

export function MatchInspector({ elements }: { elements: ElementSnapshot[] }) {
  return (
    <details className="section">
      <summary>逐字符字体匹配明细（悬停舞台字符也可查看）</summary>
      <div className="section-body">
        {elements.map((el) => {
          const web = el.chars.filter((c) => c.source === 'web' && c.char !== '\n').length;
          const sys = el.chars.filter((c) => c.source === 'system' && c.char !== '\n').length;
          const miss = el.chars.filter((c) => c.missing).length;
          const synth = el.chars.filter((c) => c.weightSynthesized).length;
          const files = new Set(el.chars.map((c) => c.fileId).filter(Boolean) as string[]);
          const families = new Set(el.chars.filter((c) => c.source === 'system').map((c) => c.family));
          return (
            <div key={el.textId}>
              <div className="field-row" style={{ marginBottom: 4 }}>
                <strong>{el.label}</strong>
                <span className="chips">
                  <span className="chip" style={{ color: 'var(--web)' }}>web {web}</span>
                  <span className="chip" style={{ color: 'var(--system)' }}>系统 {sys}</span>
                  {miss > 0 && <span className="chip" style={{ color: 'var(--danger)' }}>缺字 {miss}</span>}
                  {synth > 0 && <span className="chip" style={{ color: 'var(--purple)' }}>合成字重 {synth}</span>}
                </span>
              </div>
              <div className="hint" style={{ marginBottom: 4 }}>
                web 文件：{files.size ? [...files].join('、') : '—'} ｜ 系统回退族：
                {families.size ? [...families].join('、') : '—'}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {el.chars.map((c) => (
                  <span
                    key={c.index}
                    className={[
                      'glyph',
                      c.missing ? 'missing' : c.source === 'web' ? 'web' : 'system',
                      c.weightSynthesized ? 'synth' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    title={
                      c.char === '\n'
                        ? '换行符'
                        : `${c.char} → ${c.source === 'web' ? `${c.family}（${c.fileId}）` : c.family}${
                            c.missing ? ' · 缺失字形' : ''
                          }${c.weightSynthesized ? ' · 字重合成' : ''}`
                    }
                    style={{
                      display: 'inline-block',
                      minWidth: 14,
                      textAlign: 'center',
                      fontSize: 12,
                      border: '1px solid var(--border)',
                      borderRadius: 3,
                      padding: '0 2px',
                    }}
                  >
                    {c.char === ' ' ? '␠' : c.char === '\n' ? '⏎' : c.char}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}
