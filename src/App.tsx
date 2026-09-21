import { useEffect, useMemo, useState } from 'react';
import { defaultDoc, loadDoc, saveDoc, type FontRelayDoc, type VersionKey } from './state/store';
import { useDocHistory } from './state/useDocHistory';
import { buildScenario } from './engine/build';
import { simulate, simulateRepeated } from './engine/simulation';
import { buildRecord } from './engine/acceptance';
import { ConfigPanel } from './ui/ConfigPanel';
import { ScenarioPanel } from './ui/ScenarioPanel';
import { Stage } from './ui/Stage';
import { EventsLog, TimelineScrubber, usePlayer } from './ui/Player';
import { MetricsPanel } from './ui/MetricsPanel';
import { VerdictPanel } from './ui/VerdictPanel';
import { RecordsPanel } from './ui/RecordsPanel';
import { CompareView } from './ui/CompareView';
import { Badge } from './ui/primitives';

export default function App() {
  const [bootDoc] = useState<FontRelayDoc>(() => loadDoc());
  const H = useDocHistory(bootDoc);
  const { doc } = H;
  const [toast, setToast] = useState<string | null>(null);

  // 刷新恢复：变更后持久化
  useEffect(() => {
    saveDoc(doc);
  }, [doc]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(id);
  }, [toast]);

  // 撤销/重做快捷键
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return;
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        H.undo();
      } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
        e.preventDefault();
        H.redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [H]);

  const scenario = useMemo(() => buildScenario(doc, doc.activeVersion), [doc]);
  const result = useMemo(() => simulate(scenario), [scenario]);
  const player = usePlayer(result);
  // 场景切换后重置 effect 执行前可能存在一帧旧 index，钳制避免越界
  const frame = result.frames[Math.min(player.index, result.frames.length - 1)];

  const scenarioA = useMemo(() => buildScenario(doc, 'A'), [doc]);
  const scenarioB = useMemo(() => buildScenario(doc, 'B'), [doc]);
  const resultA = useMemo(() => simulate(scenarioA), [scenarioA]);
  const resultB = useMemo(() => simulate(scenarioB), [scenarioB]);

  const patch = (p: Partial<FontRelayDoc>) => H.dispatch({ type: 'patch', patch: p });
  const patchConfig = (key: VersionKey, p: Partial<FontRelayDoc['versions']['A']>) =>
    H.dispatch({ type: 'patchConfig', key, patch: p });
  const updateSources = (key: VersionKey, fn: (s: FontRelayDoc['versions']['A']['sources']) => FontRelayDoc['versions']['A']['sources']) =>
    H.dispatch({ type: 'patchConfig', key, patch: { sources: fn(doc.versions[key].sources) } });
  const patchCondition = (p: Partial<FontRelayDoc['condition']>) =>
    patch({ condition: { ...doc.condition, ...p } });

  const runRepeatTest = () => {
    const [r1, r2] = simulateRepeated(scenario, 2);
    const ok =
      r1.fingerprint === r2.fingerprint &&
      r1.frames.length === r2.frames.length &&
      r1.finalCls === r2.finalCls &&
      r1.stableAt === r2.stableAt;
    setToast(
      ok
        ? `重复运行一致性 ✓ 指纹 ${r1.fingerprint}（2 次运行帧数/CLS/稳定时间完全一致）`
        : '重复运行一致性 ✗ 两次结果不同，请检查配置',
    );
  };

  const saveRecord = () => {
    const rec = buildRecord({
      scenarioName: scenario.name,
      versionName: doc.versions[doc.activeVersion].versionName,
      language: doc.language,
      containerWidth: doc.containerWidth,
      result,
      thresholds: doc.thresholds,
      notes: doc.notes || undefined,
    });
    H.dispatch({ type: 'addRecord', record: rec });
    setToast(`已保存验收记录：${rec.passed ? '通过' : '未通过'}`);
  };

  return (
    <div className="app">
      <header className="topbar">
        <h1>FontRelay</h1>
        <span className="sub">Web 字体发布验收台 · 从首屏到字体稳定的逐帧比对</span>
        <span className="spacer" />
        <button onClick={H.undo} disabled={!H.canUndo} title="撤销 (Ctrl+Z)">↶ 撤销</button>
        <button onClick={H.redo} disabled={!H.canRedo} title="重做">↷ 重做</button>
        <button
          onClick={() => {
            if (confirm('恢复出厂示例配置？当前验收记录会保留在浏览器中直到清空。')) {
              const fresh = defaultDoc();
              fresh.records = doc.records;
              H.reset(fresh);
              setToast('已恢复示例配置');
            }
          }}
        >
          重置示例
        </button>
      </header>

      <div className="main">
        {/* 左：配置 */}
        <div className="col">
          <ScenarioPanel doc={doc} patch={patch} patchCondition={patchCondition} />
          <ConfigPanel
            doc={doc}
            setActive={(k) => patch({ activeVersion: k })}
            patchConfig={patchConfig}
            updateSources={updateSources}
            patchCondition={patchCondition}
          />
        </div>

        {/* 中：舞台 */}
        <div className="col">
          {doc.compare ? (
            <CompareView scenarioA={scenarioA} scenarioB={scenarioB} resultA={resultA} resultB={resultB} />
          ) : (
            <>
              <div className="panel">
                <h2>
                  舞台 · {doc.versions[doc.activeVersion].versionName}
                  <span style={{ float: 'right' }}>
                    <Badge tone="brand">{doc.versions[doc.activeVersion].display}</Badge>{' '}
                    <Badge tone={frame.changedFromFirst ? 'warn' : 'ok'}>
                      {frame.t === 0 ? '首屏' : frame.changedFromFirst ? '已偏离首屏' : '与首屏一致'}
                    </Badge>
                  </span>
                </h2>
                <Stage scenario={scenario} frame={frame} prevFrame={player.index > 0 ? result.frames[player.index - 1] : undefined} />
                <div className="row" style={{ marginTop: 10 }}>
                  <button className="primary" onClick={saveRecord}>保存验收记录</button>
                  <button onClick={runRepeatTest}>重复运行 ×2 一致性校验</button>
                  <input
                    type="text"
                    placeholder="备注（写入验收记录）"
                    value={doc.notes}
                    onChange={(e) => patch({ notes: e.target.value })}
                    style={{ flex: 1 }}
                  />
                </div>
                <div className="row" style={{ marginTop: 6 }}>
                  <span className="muted">
                    首变 {result.firstVisualChangeAt >= 0 ? `${result.firstVisualChangeAt}ms` : '无'} ·
                    稳定 {result.stableAt}ms · 累计 CLS {result.finalCls.toFixed(4)} ·
                    缺字 {result.missingGlyphs.length} · 指纹 {result.fingerprint}
                  </span>
                </div>
              </div>
              <TimelineScrubber result={result} player={player} />
              <EventsLog result={result} currentT={frame.t} />
            </>
          )}
        </div>

        {/* 右：判定 + 度量 + 记录/对比 */}
        <div className="col">
          <div className="panel">
            <h2>视图</h2>
            <div className="tabs">
              <button className={!doc.compare ? 'active' : ''} onClick={() => patch({ compare: false })}>单版本回放</button>
              <button className={doc.compare ? 'active' : ''} onClick={() => patch({ compare: true })}>A/B 版本对比</button>
            </div>
          </div>
          {!doc.compare && (
            <VerdictPanel
              result={result}
              thresholds={doc.thresholds}
              onThreshold={(p) => patch({ thresholds: { ...doc.thresholds, ...p } })}
            />
          )}
          {doc.compare && (
            <div className="panel">
              <h2>对比版本</h2>
              <div className="row">
                <Badge tone="brand">A · {doc.versions.A.versionName}</Badge>
                <span className="muted">vs</span>
                <Badge tone="brand">B · {doc.versions.B.versionName}</Badge>
              </div>
              <p className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>
                两个版本在相同语言、容器宽度与加载条件下运行；中间舞台共享时间轴，黄标行为最终态发生变化的元素。
                可在左侧切换 A/B 编辑各自配置。
              </p>
            </div>
          )}
          {!doc.compare && <MetricsPanel result={result} frame={frame} />}
          <RecordsPanel
            records={doc.records}
            onRemove={(id) => H.dispatch({ type: 'removeRecord', id })}
            onClear={() => H.dispatch({ type: 'clearRecords' })}
          />
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
