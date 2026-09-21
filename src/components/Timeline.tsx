// 底部时间线：单步 / 自动回放 / 步骤轨道
import type { RunResult } from '../core/types';
import type { Playback } from '../state/usePlayback';

const TYPE_LABEL: Record<string, string> = {
  init: '首屏',
  inject: '注入',
  load: '到达',
  fail: '失败',
  'cache-hit': '缓存命中',
  'dup-inject': '重复注入',
  settle: '字体稳定',
};

export function Timeline({ run, pb }: { run: RunResult; pb: Playback }) {
  return (
    <div className="timeline-bar">
      <div className="player-controls">
        <button onClick={pb.reset} title="回到首屏">⏮</button>
        <button onClick={pb.prev} disabled={pb.stepIndex === 0}>
          上一步
        </button>
        <button className="primary" onClick={pb.toggle}>
          {pb.playing ? '暂停' : pb.stepIndex >= pb.total - 1 ? '重新播放' : '自动播放'}
        </button>
        <button onClick={pb.next} disabled={pb.stepIndex >= pb.total - 1}>
          下一步
        </button>
        <span className="hint">
          第 {pb.stepIndex + 1}/{pb.total} 步 · t = {run.steps[pb.stepIndex]?.t ?? 0}ms
        </span>
        <span style={{ flex: 1 }} />
        <div className="legend">
          <span>
            <i className="dot" style={{ background: 'var(--web)' }} />
            web 字体字形
          </span>
          <span>
            <i className="dot" style={{ background: 'var(--system)' }} />
            系统回退字形
          </span>
          <span>
            <i className="dot" style={{ background: 'var(--danger)' }} />
            缺失字形
          </span>
          <span>
            <i className="dot" style={{ background: 'var(--purple)' }} />
            合成字重 / 版本差异
          </span>
        </div>
      </div>
      <div className="step-track">
        {run.steps.map((s, i) => (
          <button
            key={i}
            className={[
              'step-chip',
              i === pb.stepIndex ? 'active' : '',
              s.type === 'fail' ? 'fail' : '',
              s.type === 'cache-hit' ? 'cache' : '',
              s.type === 'dup-inject' ? 'dup' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => pb.seek(i)}
            title={s.note}
          >
            <div className="st">
              {i + 1}. {TYPE_LABEL[s.type] ?? s.type} · {s.t}ms
            </div>
            <div className="sn">{s.note}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
