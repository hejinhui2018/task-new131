// 顶部关键指标：CLS、稳定时刻、回退字符、失败文件、重复注入、首次视觉变化
import type { RunResult, VersionCompare } from '../core/types';
import { injectionStats } from '../core/relay';

interface Props {
  run: RunResult;
  compare: VersionCompare;
  compareMode: boolean;
}

function Metric({
  label,
  value,
  tone,
  sub,
}: {
  label: string;
  value: string;
  tone?: 'good' | 'bad' | 'warn';
  sub?: string;
}) {
  return (
    <div className={`metric ${tone ?? ''}`}>
      <div className="k">{label}</div>
      <div className="v">{value}</div>
      {sub && <div className="hint">{sub}</div>}
    </div>
  );
}

export function MetricsBar({ run, compare, compareMode }: Props) {
  const inj = injectionStats(run.injections);
  const clsTone = run.cls === 0 ? 'good' : run.cls > 0.1 ? 'bad' : 'warn';
  const settledT = run.steps[run.settledStepIndex]?.t ?? 0;
  const maxShift = run.shifts.reduce<RunResult['shifts'][number] | null>(
    (m, s) => (!m || s.score > m.score ? s : m),
    null,
  );

  return (
    <div className="metric-row">
      <Metric
        label="累计布局偏移 CLS"
        value={run.cls.toFixed(4)}
        tone={clsTone}
        sub={run.cls === 0 ? '无偏移' : `门槛 0.1000 · ${maxShift?.label ?? ''}`}
      />
      <Metric
        label="字体稳定时刻"
        value={`${settledT}ms`}
        tone={settledT === 0 ? 'good' : settledT > 1000 ? 'warn' : undefined}
        sub={`${run.steps.filter((s) => s.type === 'load').length} 个网络到达`}
      />
      <Metric
        label="系统回退字符"
        value={String(run.fellBackChars)}
        tone={run.fellBackChars === 0 ? 'good' : 'bad'}
        sub="含缺失字形"
      />
      <Metric
        label="失败文件"
        value={String(run.failedFiles.length)}
        tone={run.failedFiles.length ? 'bad' : 'good'}
        sub={run.failedFiles.join('、') || '全部成功'}
      />
      <Metric
        label="重复注入"
        value={`${inj.redundant}/${inj.total}`}
        tone={inj.redundant ? 'bad' : 'good'}
        sub={inj.redundant ? '冗余 @font-face/link' : '无冗余'}
      />
      <Metric
        label={compareMode ? '首次视觉变化 (A vs B)' : '版本对比'}
        value={
          compareMode
            ? compare.firstVisualChangeAt === null
              ? '无差异'
              : `${compare.firstVisualChangeAt}ms`
            : '未开启'
        }
        tone={
          compareMode
            ? compare.firstVisualChangeAt === null
              ? 'good'
              : 'warn'
            : undefined
        }
        sub={
          compareMode
            ? compare.firstVisualChangeAt === null
              ? '两版本逐步一致'
              : `第 ${compare.firstVisualStepIndex! + 1} 步起出现几何差异`
            : '打开开关比较 A/B'
        }
      />
    </div>
  );
}
