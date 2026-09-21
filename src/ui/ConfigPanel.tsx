import { ALL_SUBSET_IDS, SUBSETS } from '../engine/subsets';
import type { FontSource, LoadCondition, ReleaseConfig } from '../engine/types';
import type { FontRelayDoc, VersionKey } from '../state/store';
import { Section, NumberField, TextField } from './primitives';

interface Props {
  doc: FontRelayDoc;
  setActive: (key: VersionKey) => void;
  patchConfig: (key: VersionKey, patch: Partial<ReleaseConfig>) => void;
  updateSources: (key: VersionKey, fn: (s: FontSource[]) => FontSource[]) => void;
  patchCondition: (patch: Partial<LoadCondition>) => void;
}

let uid = 0;
function newSourceId(): string {
  uid += 1;
  return `src-custom-${Date.now().toString(36)}-${uid}`;
}

function SourceCard({
  source, onChange, onRemove, cacheHit, onToggleCache,
}: {
  source: FontSource;
  onChange: (s: FontSource) => void;
  onRemove: () => void;
  cacheHit: boolean;
  onToggleCache: () => void;
}) {
  const variable = Array.isArray(source.weight);
  const wLo = variable ? (source.weight as [number, number])[0] : (source.weight as number);
  const wHi = variable ? (source.weight as [number, number])[1] : (source.weight as number);

  return (
    <div className="source-card brand">
      <div className="row">
        <strong style={{ flex: 1 }}>
          {source.family}
          {variable && <span className="muted"> · 可变 wght {wLo}–{wHi}</span>}
          {!variable && <span className="muted"> · 静态 {wLo}</span>}
        </strong>
        <button className="tiny danger" onClick={onRemove}>删除</button>
      </div>
      <div className="row" style={{ marginTop: 6 }}>
        <TextField
          label="family 名"
          value={source.family}
          width={130}
          onChange={(v) => onChange({ ...source, family: v })}
        />
        <label className="field">
          可变字体
          <input
            type="checkbox"
            checked={variable}
            onChange={(e) =>
              onChange({
                ...source,
                variable: e.target.checked,
                weight: e.target.checked ? [100, 900] : 400,
              })
            }
          />
        </label>
      </div>
      <div className="grid2" style={{ marginTop: 6 }}>
        {variable ? (
          <>
            <NumberField label="wght 最小" value={wLo} onChange={(v) => onChange({ ...source, weight: [v, wHi] })} />
            <NumberField label="wght 最大" value={wHi} onChange={(v) => onChange({ ...source, weight: [wLo, v] })} />
          </>
        ) : (
          <NumberField label="字重" value={wLo} onChange={(v) => onChange({ ...source, weight: v })} />
        )}
        <NumberField label="加载耗时 ms" value={source.loadMs} min={0} onChange={(v) => onChange({ ...source, loadMs: v })} />
        <NumberField label="字宽系数" step={0.01} value={source.widthFactor} onChange={(v) => onChange({ ...source, widthFactor: v })} />
        <NumberField label="行高系数" step={0.01} value={source.lineHeightFactor} onChange={(v) => onChange({ ...source, lineHeightFactor: v })} />
        <NumberField label="注入次数" min={1} value={source.injections ?? 1} onChange={(v) => onChange({ ...source, injections: v })} />
      </div>
      <div className="row" style={{ marginTop: 6 }}>
        <label>
          <input type="checkbox" checked={!!source.fail} onChange={(e) => onChange({ ...source, fail: e.target.checked })} />
          文件失败
        </label>
        <label>
          <input type="checkbox" checked={cacheHit} onChange={onToggleCache} />
          缓存命中
        </label>
      </div>
      <h3>字符子集</h3>
      <div className="chips">
        {ALL_SUBSET_IDS.map((id) => {
          const on = source.subsets.includes(id);
          return (
            <button
              key={id}
              className={`chip ${on ? 'on' : ''}`}
              title={SUBSETS[id].label}
              onClick={() =>
                onChange({
                  ...source,
                  subsets: on ? source.subsets.filter((x) => x !== id) : [...source.subsets, id],
                })
              }
            >
              {id}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ConfigPanel(props: Props) {
  const { doc, patchConfig, updateSources } = props;
  const key = doc.activeVersion;
  const cfg = doc.versions[key];

  const addSource = () => {
    const s: FontSource = {
      id: newSourceId(),
      family: key === 'A' ? 'BrandSans' : 'BrandSansVF',
      weight: 400,
      style: 'normal',
      subsets: ['ascii'],
      loadMs: 800,
      widthFactor: 1,
      lineHeightFactor: 1,
    };
    updateSources(key, (list) => [...list, s]);
  };

  const setStackAt = (i: number, name: string) => {
    const stack = cfg.stack.map((x, j) => (j === i ? name : x));
    patchConfig(key, { stack });
  };
  const moveStack = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    const stack = cfg.stack.slice();
    if (j < 0 || j >= stack.length) return;
    [stack[i], stack[j]] = [stack[j], stack[i]];
    patchConfig(key, { stack });
  };
  const removeStackAt = (i: number) => patchConfig(key, { stack: cfg.stack.filter((_, j) => j !== i) });

  return (
    <Section
      title={`发布配置 · ${cfg.versionName}`}
      action={
        <div className="tabs" style={{ display: 'inline-flex' }}>
          <button className={key === 'A' ? 'active' : ''} onClick={() => props.setActive('A')}>版本 A</button>
          <button className={key === 'B' ? 'active' : ''} onClick={() => props.setActive('B')}>版本 B</button>
        </div>
      }
    >
      <TextField label="版本名称" value={cfg.versionName} onChange={(v) => patchConfig(key, { versionName: v })} />

      <h3>字体文件 @font-face</h3>
      {cfg.sources.map((s) => (
        <SourceCard
          key={s.id}
          source={s}
          cacheHit={doc.condition.cacheHitSourceIds.includes(s.id)}
          onToggleCache={() => {
            const ids = doc.condition.cacheHitSourceIds;
            const next = ids.includes(s.id) ? ids.filter((x) => x !== s.id) : [...ids, s.id];
            props.patchCondition({ cacheHitSourceIds: next });
          }}
          onChange={(ns) => updateSources(key, (list) => list.map((x) => (x.id === ns.id ? ns : x)))}
          onRemove={() => updateSources(key, (list) => list.filter((x) => x.id !== s.id))}
        />
      ))}
      <div className="row">
        <button className="tiny" onClick={addSource}>+ 添加字体文件</button>
      </div>

      <h3>回退顺序（font-family 栈）</h3>
      <div>
        {cfg.stack.map((name, i) => (
          <div className="stack-item" key={i}>
            <span className="muted mono">{i + 1}</span>
            <input
              className="name"
              type="text"
              value={name}
              onChange={(e) => setStackAt(i, e.target.value)}
              style={{ width: '100%', border: 'none', background: 'transparent' }}
            />
            <button className="tiny" disabled={i === 0} onClick={() => moveStack(i, -1)}>↑</button>
            <button className="tiny" disabled={i === cfg.stack.length - 1} onClick={() => moveStack(i, 1)}>↓</button>
            <button className="tiny danger" onClick={() => removeStackAt(i)}>×</button>
          </div>
        ))}
        <button
          className="tiny"
          onClick={() => patchConfig(key, { stack: [...cfg.stack, 'serif'] })}
        >
          + 添加族
        </button>
      </div>
      <p className="muted" style={{ fontSize: 11, margin: '6px 0 0' }}>
        栈中的系统族（Helvetica Neue / Arial / serif 等）始终可用；其余名称需在下方回退字体中定义。
      </p>

      <h3>回退字体度量（用于匹配未在栈中定义的名称时提示）</h3>
      <table className="metrics">
        <thead><tr><th>族</th><th>系统</th><th className="num">字宽</th><th className="num">加载ms</th><th></th></tr></thead>
        <tbody>
          {cfg.fallbacks.map((f) => (
            <tr key={f.id}>
              <td>{f.family}</td>
              <td>{f.system ? '是' : 'web'}</td>
              <td className="num">{f.widthFactor.toFixed(2)}</td>
              <td className="num">{f.system ? '—' : f.loadMs}</td>
              <td>
                <button
                  className="tiny"
                  onClick={() =>
                    patchConfig(key, {
                      fallbacks: cfg.fallbacks.map((x) =>
                        x.id === f.id
                          ? {
                              ...x,
                              system: !x.system,
                              loadMs: x.system ? 200 : x.loadMs,
                              widthFactor: x.widthFactor,
                            }
                          : x,
                      ),
                    })
                  }
                >
                  切换
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>font-display 策略</h3>
      <div className="chips">
        {(['auto', 'block', 'swap', 'fallback', 'optional'] as const).map((d) => (
          <button key={d} className={`chip ${cfg.display === d ? 'on' : ''}`} onClick={() => patchConfig(key, { display: d })}>
            {d}
          </button>
        ))}
      </div>
      <div className="grid2" style={{ marginTop: 6 }}>
        <NumberField label="block 期 ms" value={cfg.blockPeriodMs} min={0} onChange={(v) => patchConfig(key, { blockPeriodMs: v })} />
        <NumberField label="swap 期 ms" value={cfg.swapPeriodMs} min={0} onChange={(v) => patchConfig(key, { swapPeriodMs: v })} />
      </div>
    </Section>
  );
}
