import { describe, expect, it } from 'vitest';
import {
  ACCEPTANCE_THRESHOLDS,
  createRecord,
  evaluatePass,
  exportJson,
  exportMarkdown,
} from './records';
import { runRelay } from './relay';
import { DEFAULT_CONDITIONS, DEFAULT_CONFIGS, LANGUAGES } from './presets';
import type { LoadConditions } from './types';

const base = {
  config: DEFAULT_CONFIGS.a,
  conditions: { ...DEFAULT_CONDITIONS } as LoadConditions,
  containerWidth: 300,
  languageId: 'de',
};

describe('验收记录', () => {
  it('正常德语窄容器：有 CLS 偏移 → 记录可生成且不通过门槛', () => {
    const result = runRelay(base);
    expect(result.cls).toBeGreaterThan(0);
    const record = createRecord({
      releaseName: DEFAULT_CONFIGS.a.releaseName,
      languageId: 'de',
      containerWidth: 300,
      result,
      conditions: base.conditions,
      firstVisualChangeAt: 420,
    });
    expect(record.id).toMatch(/^AC-\d{8}-\d{3}$/);
    expect(record.passed).toBe(evaluatePass(result));
    expect(record.firstVisualChangeAt).toBe(420);
    expect(record.settledAtMs).toBeGreaterThan(0);
  });

  it('全缓存运行 CLS=0 且无回退字符 → 通过', () => {
    const conditions: LoadConditions = {
      ...DEFAULT_CONDITIONS,
      cachedUrls: DEFAULT_CONFIGS.a.files.map((f) => f.url),
    };
    const result = runRelay({ ...base, conditions });
    expect(result.cls).toBe(0);
    expect(evaluatePass(result)).toBe(true);
  });

  it('文件失败必然不通过', () => {
    const result = runRelay({
      ...base,
      languageId: 'vi',
      conditions: { ...DEFAULT_CONDITIONS, failFiles: ['v2-vietnamese'] },
    });
    expect(evaluatePass(result)).toBe(false);
  });

  it('重复注入必然不通过', () => {
    const url = DEFAULT_CONFIGS.a.files[0].url;
    const result = runRelay({
      ...base,
      conditions: { ...DEFAULT_CONDITIONS, duplicateInject: { [url]: 2 } },
    });
    expect(evaluatePass(result)).toBe(false);
  });

  it('exportJson 可往返解析且包含记录', () => {
    const record = createRecord({
      releaseName: 'v2',
      languageId: 'de',
      containerWidth: 300,
      result: runRelay(base),
      conditions: base.conditions,
      firstVisualChangeAt: null,
    });
    const parsed = JSON.parse(exportJson([record]));
    expect(parsed.tool).toBe('FontRelay');
    expect(parsed.records).toHaveLength(1);
    expect(parsed.records[0].id).toBe(record.id);
  });

  it('exportMarkdown 包含表头与不通过明细', () => {
    const record = createRecord({
      releaseName: 'v2',
      languageId: 'vi',
      containerWidth: 300,
      result: runRelay({
        ...base,
        languageId: 'vi',
        conditions: { ...DEFAULT_CONDITIONS, failFiles: ['v2-vietnamese'] },
      }),
      conditions: { ...DEFAULT_CONDITIONS, failFiles: ['v2-vietnamese'] },
      firstVisualChangeAt: null,
    });
    const md = exportMarkdown([record]);
    expect(md).toContain('# FontRelay');
    expect(md).toContain('不通过项明细');
    expect(md).toContain('v2-vietnamese');
    expect(md).toContain('❌');
  });

  it('门槛常量存在且 CLS 门槛为业内常用 0.1', () => {
    expect(ACCEPTANCE_THRESHOLDS.maxCls).toBe(0.1);
  });

  it('覆盖全部内置语言样本运行不抛错', () => {
    for (const lang of LANGUAGES) {
      const r = runRelay({ ...base, languageId: lang.id });
      expect(r.steps.length).toBeGreaterThan(1);
    }
  });
});
