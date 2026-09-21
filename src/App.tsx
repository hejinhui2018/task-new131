import { useEffect, useState } from 'react';
import { StoreProvider, useStore } from './state/store';
import { useRuns } from './state/useRuns';
import { usePlayback } from './state/usePlayback';
import { Controls } from './components/Controls';
import { Stage } from './components/Stage';
import { MetricsBar } from './components/MetricsBar';
import { Timeline } from './components/Timeline';
import { CompareView } from './components/CompareView';
import { MatchInspector } from './components/MatchInspector';
import { RecordsDrawer } from './components/RecordsDrawer';
import { createRecord } from './core/records';

function Shell() {
  const {
    doc,
    editDoc,
    undo,
    redo,
    canUndo,
    canRedo,
    activeConfig,
    addRecord,
    cacheMode,
    setCacheMode,
    warmCache,
    clearCache,
    cacheUrls,
  } = useStore();
  const { runA, runB, compare } = useRuns();
  const activeRun = doc.activeRelease === 'a' ? runA : runB;
  const shownRun = doc.compareMode ? runA : activeRun;
  const pb = usePlayback(doc.compareMode ? runA : activeRun);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const step = shownRun.steps[pb.stepIndex] ?? shownRun.steps[0];
  const shiftsHere = shownRun.shifts.filter((s) => s.t === step.t);

  // 键盘：⌘/Ctrl+Z 撤销、⇧⌘Z 重做、←/→ 单步、空格播放
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (typing) return;
      if (e.key === 'ArrowLeft') pb.prev();
      if (e.key === 'ArrowRight') pb.next();
      if (e.key === ' ') {
        e.preventDefault();
        pb.toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, pb]);

  const saveRecord = () => {
    addRecord(
      createRecord({
        releaseName: activeConfig.releaseName,
        languageId: doc.languageId,
        containerWidth: doc.containerWidth,
        result: shownRun,
        conditions: doc.conditions,
        comparedWith: doc.compareMode
          ? doc.activeRelease === 'a'
            ? doc.configB.releaseName
            : doc.configA.releaseName
          : undefined,
        firstVisualChangeAt: compare.firstVisualChangeAt,
      }),
    );
    setDrawerOpen(true);
  };

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">
          <span className="logo">Font</span>Relay · Web 字体发布验收台
        </span>
        <button onClick={undo} disabled={!canUndo} title="撤销 (⌘Z)">
          ↶ 撤销
        </button>
        <button onClick={redo} disabled={!canRedo} title="重做 (⇧⌘Z)">
          ↷ 重做
        </button>
        <span style={{ width: 8 }} />
        <label className="field-row" style={{ gap: 6 }}>
          <input
            type="checkbox"
            checked={doc.compareMode}
            onChange={(e) => editDoc((d) => ({ ...d, compareMode: e.target.checked }))}
          />
          对比 A/B 两个发布版本
        </label>
        <label className="field-row" style={{ gap: 6 }} title="热缓存 = 模拟刷新/二次访问（成功文件已在持久缓存中）">
          <input
            type="checkbox"
            checked={cacheMode === 'warm'}
            onChange={(e) => setCacheMode(e.target.checked ? 'warm' : 'cold')}
          />
          热缓存（刷新恢复）
        </label>
        <button
          className="tiny"
          onClick={() =>
            warmCache(
              shownRun.steps
                .filter((s) => s.type === 'load' && s.url)
                .map((s) => s.url!),
            )
          }
          title="模拟浏览器：本次成功到达的文件写入持久缓存（失败文件不写），再切到热缓存即可复现刷新"
        >
          缓存本次成功文件
        </button>
        <button className="tiny" onClick={clearCache} disabled={cacheUrls.length === 0}>
          清空缓存
        </button>
        <span className="hint">持久缓存 {cacheUrls.length} 个 URL</span>
        <span className="spacer" />
        <button className="primary" onClick={saveRecord}>
          记录本次验收
        </button>
        <button onClick={() => setDrawerOpen(true)}>验收记录</button>
      </header>

      <Controls />

      <main className="main">
        <MetricsBar run={shownRun} compare={compare} compareMode={doc.compareMode} />

        {doc.compareMode ? (
          <CompareView
            runA={runA}
            runB={runB}
            nameA={doc.configA.releaseName}
            nameB={doc.configB.releaseName}
            compare={compare}
            stepIndex={pb.stepIndex}
            containerWidth={doc.containerWidth}
            onSeekFirst={() => pb.seek(compare.firstVisualStepIndex ?? 0)}
          />
        ) : (
          <>
            <div className="stage-col">
              <div className="stage-toolbar">
                <strong>{activeConfig.releaseName}</strong>
                <span className="hint">{step.note}</span>
              </div>
              <Stage
                elements={step.elements}
                containerWidth={doc.containerWidth}
                shifts={shiftsHere}
              />
            </div>
            <MatchInspector elements={step.elements} />
          </>
        )}
      </main>

      <Timeline run={doc.compareMode ? runA : activeRun} pb={pb} />

      {drawerOpen && <RecordsDrawer onClose={() => setDrawerOpen(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
