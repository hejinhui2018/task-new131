import type { SubsetDef } from './types';

/**
 * 常用字符子集。字体文件通过子集 id 声明覆盖范围，
 * 用来模拟 “越南语带调字符没被 latin 子集覆盖” 这类问题。
 */
export const SUBSETS: Record<string, SubsetDef> = {
  ascii: {
    id: 'ascii',
    label: 'ASCII / Latin 基础',
    ranges: [[0x20, 0x7e]],
  },
  latin1: {
    id: 'latin1',
    label: 'Latin-1（德式变音等）',
    // ä ö ü ß Ä Ö Ü é è à 等
    ranges: [
      [0xa0, 0xff],
    ],
  },
  latinExtA: {
    id: 'latinExtA',
    label: 'Latin 扩展 A（越南语带调元音）',
    // ấ ầ ẩ ẫ ậ ắ ằ ẳ ặ ế ề ể ệ ố ồ ổ ộ ớ ờ ở ỡ ợ ứ ừ ử ữ ự 等
    ranges: [
      [0x100, 0x17f],
    ],
  },
  latinExtB: {
    id: 'latinExtB',
    label: 'Latin 扩展 B（部分越南语辅音）',
    ranges: [
      [0x180, 0x24f],
    ],
  },
  vietnamese: {
    id: 'vietnamese',
    label: '越南语增补（拉丁扩展附加）',
    ranges: [
      [0x1a0, 0x1b0],
      [0x1ea0, 0x1ef9],
    ],
  },
  cjk: {
    id: 'cjk',
    label: 'CJK 统一表意文字',
    ranges: [
      [0x4e00, 0x9fff],
    ],
  },
  cjkPunct: {
    id: 'cjkPunct',
    label: 'CJK 标点与全角符号',
    ranges: [
      [0x3000, 0x303f],
      [0xff00, 0xffef],
    ],
  },
  generalPunct: {
    id: 'generalPunct',
    label: '通用标点（• — … 等）',
    ranges: [
      [0x2010, 0x205f],
      [0x2026, 0x2026],
    ],
  },
  currency: {
    id: 'currency',
    label: '货币符号（€ 等）',
    ranges: [
      [0x20a0, 0x20cf],
    ],
  },
};

export const ALL_SUBSET_IDS = Object.keys(SUBSETS);

/** 判断码点是否落在子集内 */
export function subsetContains(subset: SubsetDef, cp: number): boolean {
  return subset.ranges.some(([lo, hi]) => cp >= lo && cp <= hi);
}

/** 判断码点是否被任一给定子集（含额外码点区间）覆盖 */
export function covers(
  subsetIds: string[],
  extraRanges: Array<[number, number]> | undefined,
  cp: number,
): boolean {
  if (
    extraRanges &&
    extraRanges.some(([lo, hi]) => cp >= lo && cp <= hi)
  ) {
    return true;
  }
  for (const id of subsetIds) {
    const s = SUBSETS[id];
    if (s && subsetContains(s, cp)) return true;
  }
  return false;
}
