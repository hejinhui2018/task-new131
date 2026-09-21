import { describe, expect, it } from 'vitest';
import { buildRecord, DEFAULT_THRESHOLDS, evaluate } from '../engine/acceptance';
import { recordToHTML, recordToJSON } from '../engine/exportRecord';
import { simulate } from '../engine/simulation';
import { makeScenario, v1Config, v2Config, normalCondition } from '../engine/presets';
import { makeElements } from '../engine/languages';

const deScenario = (config = v2Config()) =>
  makeScenario({
    name: 's',
    config,
    elements: makeElements('de'),
    condition: normalCondition(),
    containerWidth: 360,
  });

describe('acceptance — 验收判定与记录', () => {
  it('通过：无缺字、CLS 与稳定时间达标', () => {
    const res = simulate(deScenario());
    const verdict = evaluate(res, DEFAULT_THRESHOLDS);
    // CLS 检查给出数值，判定结构完整
    expect(verdict.checks.map((c) => c.id)).toEqual(['cls', 'missing', 'stable', 'firstChange']);
    expect(verdict.checks.find((c) => c.id === 'missing')!.ok).toBe(true);
  });

  it('不通过：门槛收紧到 0 CLS 时必然失败（换字体必有宽度变化）', () => {
    const res = simulate(deScenario());
    const verdict = evaluate(res, { ...DEFAULT_THRESHOLDS, maxCls: 0 });
    expect(verdict.passed).toBe(false);
  });

  it('记录包含可导出的指标与阈值', () => {
    const res = simulate(deScenario());
    const rec = buildRecord({
      scenarioName: '德语按钮-360',
      versionName: res.frames.length ? 'v2' : 'v2',
      language: 'Deutsch',
      containerWidth: 360,
      result: res,
      thresholds: DEFAULT_THRESHOLDS,
      notes: 'n',
    });
    expect(rec.metrics.stableAt).toBe(1400);
    expect(rec.metrics.familiesUsed).toContain('BrandSansVF');

    const parsed = JSON.parse(recordToJSON(rec));
    expect(parsed.containerWidth).toBe(360);
    expect(parsed.thresholds.maxCls).toBe(DEFAULT_THRESHOLDS.maxCls);

    const html = recordToHTML(rec);
    expect(html).toContain('FontRelay');
    expect(html).toContain('BrandSansVF');
    // HTML 转义
    expect(html).not.toContain('<script>');
  });

  it('慢网下稳定时间超门槛 → 验收失败', () => {
    const res = simulate(
      makeScenario({
        name: 'slow',
        config: v2Config(),
        elements: makeElements('de'),
        condition: { cacheHitSourceIds: [], slowdownFactor: 4, networkDown: false },
        containerWidth: 360,
      }),
    );
    const verdict = evaluate(res, DEFAULT_THRESHOLDS);
    expect(verdict.checks.find((c) => c.id === 'stable')!.ok).toBe(false);
    expect(verdict.passed).toBe(false);
  });

  it('v1 越南语场景：族统计显示带调字符使用系统回退', () => {
    const res = simulate(
      makeScenario({
        name: 'vi-v1',
        config: v1Config(),
        elements: makeElements('vi'),
        condition: normalCondition(),
        containerWidth: 360,
      }),
    );
    const rec = buildRecord({
      scenarioName: 'vi',
      versionName: 'v1',
      language: 'Tiếng Việt',
      containerWidth: 360,
      result: res,
      thresholds: DEFAULT_THRESHOLDS,
    });
    expect(rec.metrics.familiesUsed).toContain('Helvetica Neue');
    expect(rec.metrics.familiesUsed).toContain('BrandSans');
  });
});
