import type { LanguageCode, LoadCondition } from '../engine/types';
import { CONDITION_PRESETS, WIDTH_PRESETS } from '../engine/presets';
import { LANGUAGES } from '../engine/languages';
import type { FontRelayDoc } from '../state/store';
import { Section, NumberField } from './primitives';

interface Props {
  doc: FontRelayDoc;
  patch: (patch: Partial<FontRelayDoc>) => void;
  patchCondition: (patch: Partial<LoadCondition>) => void;
}

export function ScenarioPanel({ doc, patch, patchCondition }: Props) {
  const sourceIds = [...doc.versions.A.sources, ...doc.versions.B.sources].map((s) => s.id);

  return (
    <Section title="语言 · 容器 · 加载条件">
      <h3>语言 / 文案</h3>
      <div className="chips">
        {(Object.keys(LANGUAGES) as LanguageCode[]).map((code) => (
          <button
            key={code}
            className={`chip ${doc.language === code ? 'on' : ''}`}
            onClick={() => patch({ language: code })}
          >
            {LANGUAGES[code].label}
          </button>
        ))}
      </div>

      <h3>容器宽度</h3>
      <div className="chips">
        {WIDTH_PRESETS.map((p) => (
          <button
            key={p.width}
            className={`chip ${doc.containerWidth === p.width ? 'on' : ''}`}
            onClick={() => patch({ containerWidth: p.width })}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="row" style={{ marginTop: 6 }}>
        <NumberField label="自定义宽度 px" value={doc.containerWidth} min={80} max={2000} width={110} onChange={(v) => patch({ containerWidth: v })} />
        <NumberField label="字号 px" value={doc.fontSize} min={8} max={48} width={80} onChange={(v) => patch({ fontSize: v })} />
        <NumberField label="行高倍数" step={0.05} value={doc.lineHeightRatio} min={1} max={2.2} width={80} onChange={(v) => patch({ lineHeightRatio: v })} />
      </div>

      <h3>加载条件</h3>
      <div className="chips">
        {CONDITION_PRESETS.map((p) => (
          <button
            key={p.id}
            className={`chip ${doc.conditionPreset === p.id ? 'on' : ''}`}
            title={p.description}
            onClick={() => {
              const next = p.apply(doc.condition, sourceIds);
              patch({ conditionPreset: p.id, condition: next });
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="grid2" style={{ marginTop: 8 }}>
        <NumberField
          label="慢网倍乘"
          step={0.5}
          value={doc.condition.slowdownFactor}
          min={1}
          max={10}
          onChange={(v) => patchCondition({ slowdownFactor: v })}
        />
        <label className="field">
          网络断开
          <input
            type="checkbox"
            checked={doc.condition.networkDown}
            onChange={(e) => patchCondition({ networkDown: e.target.checked })}
          />
        </label>
      </div>
      <p className="muted" style={{ fontSize: 11, margin: '6px 0 0' }}>
        “缓存命中”与“文件失败”在左侧各字体文件卡片上勾选。
      </p>
    </Section>
  );
}
