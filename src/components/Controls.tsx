// 左侧配置：版本切换、字体文件/字重轴/子集/回退顺序、语言、宽度、故障条件
import { useStore } from '../state/store';
import { LANGUAGES } from '../core/presets';
import type { FontFile } from '../core/types';

function Section({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="section" open={defaultOpen}>
      <summary>{title}</summary>
      <div className="section-body">{children}</div>
    </details>
  );
}

export function Controls() {
  const { doc, editDoc, activeConfig, editActiveConfig } = useStore();
  const c = activeConfig;
  const cond = doc.conditions;

  const updateFile = (id: string, patch: Partial<FontFile>) =>
    editActiveConfig((cfg) => ({
      ...cfg,
      files: cfg.files.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    }));

  const toggleFail = (id: string) =>
    editDoc((d) => ({
      ...d,
      conditions: {
        ...d.conditions,
        failFiles: d.conditions.failFiles.includes(id)
          ? d.conditions.failFiles.filter((x) => x !== id)
          : [...d.conditions.failFiles, id],
      },
    }));

  const setDuplicate = (url: string, times: number) =>
    editDoc((d) => ({
      ...d,
      conditions: {
        ...d.conditions,
        duplicateInject: { ...d.conditions.duplicateInject, [url]: times },
      },
    }));

  return (
    <aside className="sidebar">
      <Section title="发布版本 / 字重轴 / 文件" defaultOpen>
        <div className="field-row">
          <button
            className={doc.activeRelease === 'a' ? 'primary tiny' : 'tiny'}
            onClick={() => editDoc((d) => ({ ...d, activeRelease: 'a' }))}
          >
            A · {doc.configA.releaseName}
          </button>
          <button
            className={doc.activeRelease === 'b' ? 'primary tiny' : 'tiny'}
            onClick={() => editDoc((d) => ({ ...d, activeRelease: 'b' }))}
          >
            B · {doc.configB.releaseName}
          </button>
        </div>
        <div className="field">
          <label>版本名称</label>
          <input
            value={c.releaseName}
            onChange={(e) => editActiveConfig((cfg) => ({ ...cfg, releaseName: e.target.value }))}
          />
        </div>
        <div className="field">
          <label>font-family</label>
          <input
            value={c.family}
            onChange={(e) => editActiveConfig((cfg) => ({ ...cfg, family: e.target.value }))}
          />
        </div>
        {c.files.map((f) => (
          <div key={f.id} className="check-list" style={{ maxHeight: 'none' }}>
            <div className="field-row">
              <strong className="mono" style={{ fontSize: 11 }}>
                {f.variable ? 'VF' : '静态'} · {f.label.split('·')[1]?.trim() ?? f.label}
              </strong>
              <span className={`tag ${cond.failFiles.includes(f.id) ? 'on' : ''}`}>
                {f.axis.min}–{f.axis.max} wght
              </span>
            </div>
            <div className="field-row">
              <label>到达延迟</label>
              <input
                className="num-input"
                type="number"
                min={0}
                step={20}
                value={f.latencyMs}
                onChange={(e) => updateFile(f.id, { latencyMs: Number(e.target.value) || 0 })}
              />
              ms
            </div>
            <div className="field-row">
              <label>轴最小 / 默认 / 最大</label>
            </div>
            <div className="field-row" style={{ gap: 4 }}>
              {(['min', 'default', 'max'] as const).map((k) => (
                <input
                  key={k}
                  className="num-input"
                  type="number"
                  step={50}
                  value={f.axis[k]}
                  onChange={(e) =>
                    updateFile(f.id, { axis: { ...f.axis, [k]: Number(e.target.value) || 0 } })
                  }
                />
              ))}
            </div>
            <label>
              <input
                type="checkbox"
                checked={f.variable}
                onChange={(e) => updateFile(f.id, { variable: e.target.checked })}
              />
              可变字体（轴可插值）
            </label>
            <div className="chips">
              {f.subsetIds.map((sid) => (
                <span key={sid} className="chip">
                  {sid}
                  <button
                    title="移除该子集"
                    onClick={() =>
                      updateFile(f.id, { subsetIds: f.subsetIds.filter((x) => x !== sid) })
                    }
                  >
                    ×
                  </button>
                </span>
              ))}
              {c.subsets
                .filter((s) => !f.subsetIds.includes(s.id))
                .map((s) => (
                  <button
                    key={s.id}
                    className="tiny"
                    onClick={() => updateFile(f.id, { subsetIds: [...f.subsetIds, s.id] })}
                  >
                    + {s.id}
                  </button>
                ))}
            </div>
            <div className="field-row">
              <label>
                <input
                  type="checkbox"
                  checked={cond.failFiles.includes(f.id)}
                  onChange={() => toggleFail(f.id)}
                />
                模拟文件加载失败
              </label>
            </div>
            <div className="field-row">
              <label>重复注入次数</label>
              <select
                className="num-input"
                value={cond.duplicateInject[f.url] ?? 1}
                onChange={(e) => setDuplicate(f.url, Number(e.target.value))}
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </Section>

      <Section title="字符子集（字符覆盖）">
        {c.subsets.map((s) => (
          <div key={s.id} className="field">
            <label>
              {s.label} <span className="hint">（{Array.from(s.chars).length} 字符）</span>
            </label>
            <textarea
              rows={2}
              value={s.chars}
              onChange={(e) =>
                editActiveConfig((cfg) => ({
                  ...cfg,
                  subsets: cfg.subsets.map((x) =>
                    x.id === s.id ? { ...x, chars: e.target.value } : x,
                  ),
                }))
              }
            />
          </div>
        ))}
      </Section>

      <Section title="回退字体顺序" defaultOpen>
        <p className="hint">浏览器沿字体栈逐字符找字形；空覆盖集合为兜底 .notdef。</p>
        {c.fallbacks.map((f, i) => (
          <div key={f.id} className="fallback-row">
            <strong>{i + 1}.</strong>
            <span className="name" title={f.family}>
              {f.label}
            </span>
            <button
              className="tiny"
              disabled={i === 0}
              onClick={() =>
                editActiveConfig((cfg) => {
                  const arr = [...cfg.fallbacks];
                  [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
                  return { ...cfg, fallbacks: arr };
                })
              }
            >
              ↑
            </button>
            <button
              className="tiny"
              disabled={i === c.fallbacks.length - 1}
              onClick={() =>
                editActiveConfig((cfg) => {
                  const arr = [...cfg.fallbacks];
                  [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
                  return { ...cfg, fallbacks: arr };
                })
              }
            >
              ↓
            </button>
          </div>
        ))}
      </Section>

      <Section title="语言样本 / 容器宽度" defaultOpen>
        <div className="field">
          <label>语言</label>
          <select
            value={doc.languageId}
            onChange={(e) => editDoc((d) => ({ ...d, languageId: e.target.value }))}
          >
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>
            容器宽度 <strong className="mono">{doc.containerWidth}px</strong>
          </label>
          <input
            type="range"
            min={160}
            max={720}
            step={4}
            value={doc.containerWidth}
            onChange={(e) => editDoc((d) => ({ ...d, containerWidth: Number(e.target.value) }))}
          />
          <div className="field-row">
            {[240, 320, 480, 640].map((w) => (
              <button key={w} className="tiny" onClick={() => editDoc((d) => ({ ...d, containerWidth: w }))}>
                {w}
              </button>
            ))}
          </div>
        </div>
      </Section>

      <Section title="加载条件与故障注入" defaultOpen>
        <div className="field">
          <label>
            附加网络延迟 <strong className="mono">{cond.networkExtraMs}ms</strong>（慢网）
          </label>
          <input
            type="range"
            min={0}
            max={5000}
            step={100}
            value={cond.networkExtraMs}
            onChange={(e) =>
              editDoc((d) => ({
                ...d,
                conditions: { ...d.conditions, networkExtraMs: Number(e.target.value) },
              }))
            }
          />
        </div>
        <div className="field">
          <label>强制缺失字形（输入字符，立即落回退字体并标红）</label>
          <input
            placeholder="如：ảệĐ"
            value={cond.missingGlyphs.join('')}
            onChange={(e) =>
              editDoc((d) => ({
                ...d,
                conditions: {
                  ...d.conditions,
                  missingGlyphs: Array.from(new Set(Array.from(e.target.value))),
                },
              }))
            }
          />
        </div>
        <CacheControl />
      </Section>
    </aside>
  );
}

function CacheControl() {
  const { doc, editDoc, cacheUrls } = useStore();
  const activeFiles = (doc.activeRelease === 'a' ? doc.configA : doc.configB).files;
  const selected = doc.conditions.cachedUrls;

  const toggleUrl = (url: string) =>
    editDoc((d) => ({
      ...d,
      conditions: {
        ...d.conditions,
        cachedUrls: selected.includes(url)
          ? selected.filter((u) => u !== url)
          : [...selected, url],
      },
    }));

  return (
    <div className="field">
      <label>缓存命中（首屏前已就绪，t=0 可用）</label>
      <div className="check-list">
        {activeFiles.map((f) => {
          const warm = selected.includes(f.url);
          const persisted = cacheUrls.includes(f.url);
          return (
            <label key={f.id}>
              <input type="checkbox" checked={warm} onChange={() => toggleUrl(f.url)} />
              <span>
                {f.label.split('·')[1]?.trim() ?? f.id}
                {persisted && <span className="tag on" style={{ marginLeft: 6 }}>已持久缓存</span>}
              </span>
            </label>
          );
        })}
      </div>
      <div className="field-row">
        <button
          className="tiny"
          onClick={() =>
            editDoc((d) => ({
              ...d,
              conditions: { ...d.conditions, cachedUrls: activeFiles.map((f) => f.url) },
            }))
          }
        >
          全选
        </button>
        <button
          className="tiny"
          onClick={() => editDoc((d) => ({ ...d, conditions: { ...d.conditions, cachedUrls: [] } }))}
        >
          清空
        </button>
      </div>
    </div>
  );
}
