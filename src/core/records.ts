// 验收记录：生成、导出 JSON / Markdown
import type { AcceptanceRecord, RunResult } from './types';

export interface RecordInput {
  releaseName: string;
  languageId: string;
  containerWidth: number;
  result: RunResult;
  conditions: AcceptanceRecord['conditions'];
  comparedWith?: string;
  firstVisualChangeAt: number | null;
  notes?: string;
}

/** 验收门槛（可按品牌规范调整） */
export const ACCEPTANCE_THRESHOLDS = {
  maxCls: 0.1,
  maxFallbackChars: 0,
  allowFailedFiles: false,
  allowRedundantInjections: false,
};

export function evaluatePass(result: RunResult): boolean {
  if (result.cls > ACCEPTANCE_THRESHOLDS.maxCls) return false;
  if (result.fellBackChars > ACCEPTANCE_THRESHOLDS.maxFallbackChars) return false;
  if (!ACCEPTANCE_THRESHOLDS.allowFailedFiles && result.failedFiles.length > 0) return false;
  const redundant = result.injections.filter((i) => i.redundant).length;
  if (!ACCEPTANCE_THRESHOLDS.allowRedundantInjections && redundant > 0) return false;
  return true;
}

let counter = 0;
export function createRecord(input: RecordInput): AcceptanceRecord {
  counter += 1;
  const { result } = input;
  const maxShift = result.shifts.reduce<RunResult['shifts'][number] | null>(
    (mx, s) => (!mx || s.score > mx.score ? s : mx),
    null,
  );
  return {
    id: `AC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(counter).padStart(3, '0')}`,
    createdAt: new Date().toISOString(),
    releaseName: input.releaseName,
    languageId: input.languageId,
    containerWidth: input.containerWidth,
    conditions: input.conditions,
    cls: result.cls,
    maxShift,
    fellBackChars: result.fellBackChars,
    failedFiles: result.failedFiles,
    redundantInjections: result.injections.filter((i) => i.redundant).length,
    settledAtMs: result.steps[result.settledStepIndex]?.t ?? 0,
    passed: evaluatePass(result),
    notes: input.notes,
    comparedWith: input.comparedWith,
    firstVisualChangeAt: input.firstVisualChangeAt,
  };
}

export function exportJson(records: AcceptanceRecord[]): string {
  return JSON.stringify(
    { tool: 'FontRelay', version: 1, exportedAt: new Date().toISOString(), records },
    null,
    2,
  );
}

export function exportMarkdown(records: AcceptanceRecord[]): string {
  const lines: string[] = [
    '# FontRelay 字体发布验收记录',
    '',
    `导出时间：${new Date().toLocaleString()}`,
    '',
    '| 编号 | 版本 | 语言 | 容器宽 | CLS | 回退字符 | 失败文件 | 重复注入 | 稳定时刻 | 首次视觉变化 | 结论 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const r of records) {
    lines.push(
      [
        r.id,
        r.releaseName,
        r.languageId,
        `${r.containerWidth}px`,
        r.cls.toFixed(4),
        String(r.fellBackChars),
        r.failedFiles.length ? r.failedFiles.join('、') : '—',
        String(r.redundantInjections),
        `${r.settledAtMs}ms`,
        r.firstVisualChangeAt === null ? '无差异' : `${r.firstVisualChangeAt}ms`,
        r.passed ? '✅ 通过' : '❌ 不通过',
      ].join(' | '),
    );
  }
  lines.push('', '## 不通过项明细', '');
  for (const r of records.filter((x) => !x.passed)) {
    lines.push(`### ${r.id} · ${r.releaseName}（${r.languageId}）`);
    if (r.cls > ACCEPTANCE_THRESHOLDS.maxCls) lines.push(`- CLS ${r.cls.toFixed(4)} 超过门槛 ${ACCEPTANCE_THRESHOLDS.maxCls}`);
    if (r.fellBackChars > 0) lines.push(`- ${r.fellBackChars} 个字符最终仍落在系统字体 / 缺字`);
    if (r.failedFiles.length) lines.push(`- 文件加载失败：${r.failedFiles.join('、')}`);
    if (r.redundantInjections > 0) lines.push(`- 检测到 ${r.redundantInjections} 次重复注入`);
    if (r.maxShift) {
      lines.push(
        `- 最大偏移：${r.maxShift.label}，${r.maxShift.reason}（Δ高 ${r.maxShift.deltaHeight}px，Δ行 ${r.maxShift.deltaLines}）`,
      );
    }
    lines.push('');
  }
  return lines.join('\n');
}

export function download(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
