// 验收记录抽屉：列表、导出 JSON / Markdown、删除 / 清空
import { useStore } from '../state/store';
import { download, exportJson, exportMarkdown } from '../core/records';
import { LANGUAGES } from '../core/presets';
import type { AcceptanceRecord } from '../core/types';

export function RecordsDrawer({ onClose }: { onClose: () => void }) {
  const { records, removeRecord, clearRecords } = useStore();
  const langName = (id: string) => LANGUAGES.find((l) => l.id === id)?.label ?? id;

  return (
    <>
      <div className="drawer-mask" onClick={onClose} />
      <aside className="drawer">
        <div className="field-row">
          <h2 style={{ margin: 0, fontSize: 15 }}>验收记录（{records.length}）</h2>
          <span style={{ flex: 1 }} />
          <button
            disabled={!records.length}
            onClick={() => download(`fontrelay-records.json`, exportJson(records), 'application/json')}
          >
            导出 JSON
          </button>
          <button
            disabled={!records.length}
            onClick={() => download(`fontrelay-records.md`, exportMarkdown(records), 'text/markdown')}
          >
            导出 Markdown
          </button>
          <button className="ghost" onClick={onClose}>
            关闭
          </button>
        </div>
        {records.length === 0 && <p className="hint">还没有验收记录。在顶栏点击「记录本次验收」。</p>}
        {records.map((r) => (
          <RecordCard key={r.id} r={r} langName={langName(r.languageId)} onRemove={() => removeRecord(r.id)} />
        ))}
        {records.length > 0 && (
          <button className="danger" onClick={clearRecords}>
            清空全部记录
          </button>
        )}
      </aside>
    </>
  );
}

function RecordCard({
  r,
  langName,
  onRemove,
}: {
  r: AcceptanceRecord;
  langName: string;
  onRemove: () => void;
}) {
  return (
    <div className="record-card">
      <div className="row">
        <strong className="mono">{r.id}</strong>
        <span className={`badge ${r.passed ? 'pass' : 'fail'}`}>{r.passed ? '通过' : '不通过'}</span>
      </div>
      <div className="row" style={{ marginTop: 4 }}>
        <span>
          {r.releaseName} · {langName} · {r.containerWidth}px
          {r.comparedWith ? ` · 对比 ${r.comparedWith}` : ''}
        </span>
        <button className="tiny danger" onClick={onRemove}>
          删除
        </button>
      </div>
      <div className="row hint" style={{ marginTop: 4 }}>
        <span>
          CLS {r.cls.toFixed(4)} · 回退 {r.fellBackChars} · 失败 {r.failedFiles.length} · 重复注入{' '}
          {r.redundantInjections}
        </span>
        <span>
          稳定 {r.settledAtMs}ms · 首变 {r.firstVisualChangeAt === null ? '无' : `${r.firstVisualChangeAt}ms`}
        </span>
      </div>
      {r.maxShift && (
        <div className="row hint" style={{ marginTop: 2 }}>
          最大偏移：{r.maxShift.label}（{r.maxShift.reason}）
        </div>
      )}
      <div className="hint" style={{ marginTop: 2 }}>{new Date(r.createdAt).toLocaleString()}</div>
    </div>
  );
}
