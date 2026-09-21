// 单步 / 自动回放控制
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RunResult } from '../core/types';

export interface Playback {
  stepIndex: number;
  total: number;
  playing: boolean;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  reset: () => void;
  seek: (i: number) => void;
}

export function usePlayback(run: RunResult, intervalMs = 950): Playback {
  const total = run.steps.length;
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const runRef = useRef(run);

  // 运行参数变化 → 回到首屏并暂停
  useEffect(() => {
    if (runRef.current !== run) {
      runRef.current = run;
      setStepIndex(0);
      setPlaying(false);
    }
  }, [run]);

  // 越界保护
  useEffect(() => {
    if (stepIndex > total - 1) setStepIndex(total - 1);
  }, [total, stepIndex]);

  const seek = useCallback(
    (i: number) => setStepIndex(Math.max(0, Math.min(total - 1, i))),
    [total],
  );
  const next = useCallback(() => {
    setStepIndex((i) => {
      if (i >= total - 1) {
        setPlaying(false);
        return i;
      }
      return i + 1;
    });
  }, [total]);
  const prev = useCallback(() => setStepIndex((i) => Math.max(0, i - 1)), []);
  const reset = useCallback(() => {
    setPlaying(false);
    setStepIndex(0);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => next(), intervalMs);
    return () => window.clearInterval(id);
  }, [playing, next, intervalMs]);

  return {
    stepIndex,
    total,
    playing,
    play: () => setPlaying(true),
    pause: () => setPlaying(false),
    toggle: () => (stepIndex >= total - 1 ? reset() : setPlaying((p) => !p)),
    next,
    prev,
    reset,
    seek,
  };
}
