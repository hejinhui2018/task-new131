import type { AcceptanceRecord } from '../engine/types';
import { download, recordToHTML, recordToJSON } from '../engine/exportRecord';
import { LANGUAGE_LABEL } from '../engine/presets';
import { Section, Badge } from './primitives';

export function RecordsPanel({
  records,
  onRemove,
  onClear,
}: {
  records: AcceptanceRecord[];
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  const exportOne = (r: AcceptanceRecord, html: boolean) => {
    const name = `fontrelay-${r.versionName.replace(/\s+/g, '_')}-${r.language}-${r.containerWidth}`;
    download(
      `${name}.${html ? 'html' : 'json'}`,
      html ? recordToHTML(r) : recordToJSON(r),
      html ? 'text/html;charset=utf-8' : 'application/json',
    );
  };

  return (
    <Section
      title={`验收记录（${records.length}）`}
      action={records.length > 0 ? <button className="tiny danger" onClick={onClear}>清空</button> : undefined}
    >
      {records.length === 0 && <p className="muted" style={{ fontSize: 12 }}>还没有记录。在舞台下方点击「保存验收记录」。</p>}
      {records.map((r) => (
        <div key={r.id} className={`rec ${r.passed ? 'pass' : 'fail'}`}>
          <Badge tone={r.passed ? 'ok' : 'bad'}>{r.passed ? '通过' : '未过'}</Badge>
          <div style={{ flex: 1 }}>
            <div>
              <strong>{r.versionName}</strong> · {LANGUAGE_LABEL[r.language as keyof typeof LANGUAGE_LABEL] ?? r.language} · {r.containerWidth}px
            </div>
            <div className="muted" style={{ fontSize: 10.5 }}>
              CLS {r.metrics.finalCls} · 稳定 {r.metrics.stableAt}ms · 缺字 {r.metrics.missingCount} · {new Date(r.createdAt).toLocaleString()}
            </div>
          </div>
          <button className="tiny" onClick={() => exportOne(r, false)}>JSON</button>
          <button className="tiny" onClick={() => exportOne(r, true)}>HTML</button>
          <button className="tiny danger" onClick={() => onRemove(r.id)}>删</button>
        </div>
      ))}
    </Section>
  );
}
