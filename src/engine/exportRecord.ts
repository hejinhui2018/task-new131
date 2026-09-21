import type { AcceptanceRecord } from './types';

export function recordToJSON(record: AcceptanceRecord): string {
  return JSON.stringify(record, null, 2);
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;');
}

/** 生成可离线查看的自包含 HTML 验收报告 */
export function recordToHTML(record: AcceptanceRecord): string {
  const rows = record.metrics.familiesUsed.map((f) => `<li>${esc(f)}</li>`).join('');
  const badge = record.passed
    ? '<span style="background:#16794c;color:#fff;padding:4px 12px;border-radius:999px">验收通过</span>'
    : '<span style="background:#b3261e;color:#fff;padding:4px 12px;border-radius:999px">验收未通过</span>';
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>FontRelay 验收记录 · ${esc(record.versionName)}</title></head>
<body style="font-family:system-ui,sans-serif;max-width:720px;margin:40px auto;color:#1f2328">
  <h1>FontRelay 字体发布验收记录</h1>
  <p>${badge}</p>
  <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%">
    <tr><th align="left">版本</th><td>${esc(record.versionName)}</td></tr>
    <tr><th align="left">场景</th><td>${esc(record.scenarioName)}</td></tr>
    <tr><th align="left">语言</th><td>${esc(record.language)}</td></tr>
    <tr><th align="left">容器宽度</th><td>${record.containerWidth}px</td></tr>
    <tr><th align="left">记录时间</th><td>${esc(record.createdAt)}</td></tr>
    <tr><th align="left">累计 CLS</th><td>${record.metrics.finalCls}</td></tr>
    <tr><th align="left">首次视觉变化</th><td>${record.metrics.firstVisualChangeAt}ms</td></tr>
    <tr><th align="left">字体稳定</th><td>${record.metrics.stableAt}ms</td></tr>
    <tr><th align="left">缺字数量</th><td>${record.metrics.missingCount}</td></tr>
    <tr><th align="left">最大行数</th><td>${record.metrics.lineCountMax}</td></tr>
    <tr><th align="left">最终使用字体</th><td><ul style="margin:4px 0">${rows}</ul></td></tr>
    ${record.notes ? `<tr><th align="left">备注</th><td>${esc(record.notes)}</td></tr>` : ''}
  </table>
</body></html>`;
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
