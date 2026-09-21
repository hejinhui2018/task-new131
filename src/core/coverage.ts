// 字符集合 / 子集覆盖工具
import type { FontConfig, FontFile, SubsetDef } from './types';

/** 把字符集合字符串转成 Set（自动去重） */
export function toCharSet(chars: string): Set<string> {
  return new Set(Array.from(chars));
}

/** 求两个字符集合的交集（返回字符数组） */
export function intersect(set: Set<string>, chars: string): string[] {
  const out: string[] = [];
  for (const ch of Array.from(chars)) {
    if (set.has(ch)) out.push(ch);
  }
  return out;
}

/** 文本中出现的全部去重字符（保持出现顺序） */
export function uniqueChars(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const ch of Array.from(text)) {
    if (!seen.has(ch)) {
      seen.add(ch);
      out.push(ch);
    }
  }
  return out;
}

/** 文本里不在给定字符集合内的字符 */
export function charsNotIn(text: string, set: Set<string>): string[] {
  return uniqueChars(text).filter((c) => !set.has(c));
}

/** 一个子集是否包含某字符 */
export function subsetCovers(subset: SubsetDef, ch: string): boolean {
  return subset.chars.includes(ch);
}

/** 建立子集 id -> 字符集合 映射 */
export function subsetMap(config: FontConfig): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const s of config.subsets) m.set(s.id, toCharSet(s.chars));
  return m;
}

/** 文件覆盖的全部字符（其所有子集的并集） */
export function fileCoverage(file: FontFile, subsets: Map<string, Set<string>>): Set<string> {
  const union = new Set<string>();
  for (const id of file.subsetIds) {
    const set = subsets.get(id);
    if (set) for (const ch of set) union.add(ch);
  }
  return union;
}

/** CJK 全角字符判定（这些字形恒按 1em 宽度排版） */
export function isFullWidth(ch: string): boolean {
  const cp = ch.codePointAt(0) ?? 0;
  return (
    (cp >= 0x2e80 && cp <= 0x9fff) ||
    (cp >= 0xac00 && cp <= 0xd7af) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xff00 && cp <= 0xffef)
  );
}
