import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIGS } from './presets';
import { matchText } from './matcher';
import type { MatchContext } from './matcher';
import type { FontConfig } from './types';

const v2 = DEFAULT_CONFIGS.a;

function ctx(config: FontConfig, readyIds: string[], missing: string[] = []): MatchContext {
  return {
    config,
    readyFileIds: new Set(readyIds),
    missingOverride: new Set(missing),
  };
}

describe('字体匹配 matchText', () => {
  it('没有任何文件就绪时全部走系统回退', () => {
    const chars = matchText('Hallo', 400, 16, ctx(v2, []));
    expect(chars.every((c) => c.source === 'system')).toBe(true);
    expect(chars[0].family).toContain('system-ui');
  });

  it('latin 文件就绪后 ASCII 字符使用 web 字体', () => {
    const chars = matchText('Hallo', 400, 16, ctx(v2, ['v2-latin']));
    expect(chars.every((c) => c.source === 'web')).toBe(true);
    expect(chars.every((c) => c.fileId === 'v2-latin')).toBe(true);
  });

  it('德语变元音在 latin-ext 未到达时走系统回退，到达后切换 web', () => {
    const before = matchText('Größe', 600, 16, ctx(v2, ['v2-latin']));
    // ö/ß 不在 latin 子集
    expect(before[2].source).toBe('system');
    expect(before[3].source).toBe('system');
    expect(before[0].source).toBe('web');

    const after = matchText('Größe', 600, 16, ctx(v2, ['v2-latin', 'v2-latin-ext']));
    expect(after.every((c) => c.source === 'web')).toBe(true);
    expect(after[2].fileId).toBe('v2-latin-ext');
  });

  it('越南语带调元音只有 vietnamese 文件能覆盖', () => {
    const c1 = matchText('Trải nghiệm', 700, 38, ctx(v2, ['v2-latin', 'v2-latin-ext']));
    const vietIdx = [2, 9]; // ả、ệ
    for (const i of vietIdx) expect(c1[i].source).toBe('system');
    // 回退链里由 Tahoma（越南语回退）承接
    expect(c1[2].family).toBe('Tahoma');

    const c2 = matchText('Trải nghiệm', 700, 38, ctx(v2, ['v2-latin', 'v2-latin-ext', 'v2-vietnamese']));
    for (const i of vietIdx) {
      expect(c2[i].source).toBe('web');
      expect(c2[i].fileId).toBe('v2-vietnamese');
    }
  });

  it('中文字符在 v2 无 CJK 文件时恒走 PingFang 回退', () => {
    const chars = matchText('字体', 700, 38, ctx(v2, ['v2-latin', 'v2-latin-ext', 'v2-vietnamese', 'v2-cyrillic']));
    expect(chars[0].source).toBe('system');
    expect(chars[0].family).toContain('PingFang');
  });

  it('西里尔字符由 cyrillic 文件覆盖，未到达时走 Segoe UI 回退', () => {
    const before = matchText('Привет', 400, 16, ctx(v2, ['v2-latin']));
    expect(before[0].family).toContain('Segoe UI');
    const after = matchText('Привет', 400, 16, ctx(v2, ['v2-latin', 'v2-cyrillic']));
    expect(after[0].fileId).toBe('v2-cyrillic');
  });

  it('缺失字形故障：即使文件声明覆盖，也跳过 web 并标记 missing', () => {
    const chars = matchText('Đăng', 400, 16, ctx(v2, ['v2-latin', 'v2-vietnamese'], ['Đ']));
    expect(chars[0].source).toBe('system');
    expect(chars[0].missing).toBe(true);
    // 其余字符正常
    expect(chars[1].source).toBe('web');
  });
});

describe('字重轴匹配', () => {
  it('可变字体支持任意字重，不合成', () => {
    const chars = matchText('Bold', 800, 16, ctx(v2, ['v2-latin']));
    expect(chars[0].weightSynthesized).toBe(false);
  });

  it('可变字体请求超出轴范围时钳制并标记合成', () => {
    const chars = matchText('Black', 900, 16, ctx(v2, ['v2-latin']));
    expect(chars[0].weightSynthesized).toBe(true);
  });

  it('v1 静态字体只有 400 实例，700 请求走粗体文件', () => {
    const v1 = DEFAULT_CONFIGS.b;
    const chars = matchText('Fett', 700, 16, ctx(v1, ['v1-latin', 'v1-latin-ext', 'v1-bold']));
    expect(chars[0].fileId).toBe('v1-bold');
    expect(chars[0].weightSynthesized).toBe(false);
  });

  it('v1 静态字体 600 请求落到 400 文件并标记合成（faux bold）', () => {
    const v1 = DEFAULT_CONFIGS.b;
    const chars = matchText('Button', 600, 16, ctx(v1, ['v1-latin']));
    expect(chars[0].fileId).toBe('v1-latin');
    expect(chars[0].weightSynthesized).toBe(true);
  });
});
