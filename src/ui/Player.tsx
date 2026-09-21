import { useEffect, useRef, useState } from 'react';
import type { SimulationResult } from '../engine/types';

export interface PlayerState {
  index: number;
  playing: boolean;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  restart: () => void;
  step: (dir: -1 | 1) => void;
  seek: (i: number) => void;
}

export function usePlayer(result: SimulationResult, speedMs = 850): PlayerState {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const resultRef = useRef(result);

  // 场景变化（result 身份变化）时回到首帧并暂停
  useEffect(() => {
    resultRef.current = result;
    setIndex(0);
    setPlaying(false);
  }, [result]);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setIndex((i) => {
        if (i >= resultRef.current.frames.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, speedMs);
    return () => window.clearInterval(id);
  }, [playing, speedMs]);

  return {
    index,
    playing,
    play: () => setPlaying(true),
    pause: () => setPlaying(false),
    toggle: () => (playing ? setPlaying(false) : index >= result.frames.length - 1 ? (setIndex(0), setPlaying(true)) : setPlaying(true)),
    restart: () => {
      setIndex(0);
      setPlaying(true);
    },
    step: (dir) => {
      setPlaying(false);
      setIndex((i) => Math.max(0, Math.min(result.frames.length - 1, i + dir)));
    },
    seek: (i) => {
      setPlaying(false);
      setIndex(Math.max(0, Math.min(result.frames.length - 1, i)));
    },
  };
}

const KIND_LABEL: Record<string, string> = {
  'first-paint': '首屏',
  'cache-hit': '缓存命中',
  'load-start': '开始加载',
  'font-load': '字体到达',
  'font-fail': '加载失败',
  swap: '视觉变化',
  'fallback-load': '回退到达',
  'block-end': 'block 结束',
  stable: '稳定',
  'duplicate-injection': '重复注入',
  'repeat-run': '重复运行',
};

const PHASE_LABEL = { block: 'block 隐形期', swap: 'swap 替换期', stable: '已稳定' } as const;

export function TimelineScrubber({ result, player }: { result: SimulationResult; player: PlayerState }) {
  return (
    <div className="panel">
      <h2>时间线回放</h2>
      <div className="row">
        <button onClick={() => player.restart()} title="从头播放">⏮</button>
        <button onClick={() => player.step(-1)} disabled={player.index === 0}>← 单步</button>
        <button className="primary" onClick={player.toggle}>{player.playing ? '暂停' : '自动播放'}</button>
        <button onClick={() => player.step(1)} disabled={player.index >= result.frames.length - 1}>单步 →</button>
        <span className="spacer" />
        <span className="mono">
          帧 {player.index + 1}/{result.frames.length} · t={result.frames[player.index].t}ms · {PHASE_LABEL[result.frames[player.index].phase]}
        </span>
      </div>
      <div className="framescroll" style={{ marginTop: 8 }}>
        {result.frames.map((f, i) => (
          <button
            key={i}
            className={`fframe ${i === player.index ? 'cur' : ''} ${i === result.firstVisualChangeFrame ? 'first-change' : ''}`}
            onClick={() => player.seek(i)}
            title={i === result.firstVisualChangeFrame ? '第一次视觉变化' : PHASE_LABEL[f.phase]}
          >
            {f.t}ms
            <div>{PHASE_LABEL[f.phase].slice(0, 2)}</div>
          </button>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 11, margin: '4px 0 0' }}>
        黄框 = 第一次视觉变化（第 {result.firstVisualChangeFrame >= 0 ? result.firstVisualChangeFrame + 1 : '—'} 帧，
        {result.firstVisualChangeAt >= 0 ? `${result.firstVisualChangeAt}ms` : '无变化'}）
      </p>
    </div>
  );
}

const EVENT_CLASS: Record<string, string> = {
  'block-end': 'block',
  'font-load': 'load',
  'load-start': 'load',
  'cache-hit': 'load',
  'fallback-load': 'load',
  'font-fail': 'fail',
  swap: 'swap',
  stable: 'stable',
};

export function EventsLog({ result, currentT }: { result: SimulationResult; currentT: number }) {
  return (
    <div className="panel">
      <h2>事件流水</h2>
      <div className="events">
        {result.events.map((e, i) => (
          <div key={i} className={`ev ${EVENT_CLASS[e.kind] ?? ''}`} style={{ opacity: e.t <= currentT ? 1 : 0.35 }}>
            <span className="t">{e.t}ms</span>
            <span className="k">{KIND_LABEL[e.kind] ?? e.kind}</span>
            <span>{e.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
