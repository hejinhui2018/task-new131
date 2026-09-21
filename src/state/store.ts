import type {
  AcceptanceRecord,
  ClsThresholds,
  LanguageCode,
  LoadCondition,
  ReleaseConfig,
} from '../engine/types';
import { v1Config, v2Config } from '../engine/presets';
import { DEFAULT_THRESHOLDS } from '../engine/acceptance';

export type VersionKey = 'A' | 'B';

export interface FontRelayDoc {
  language: LanguageCode;
  containerWidth: number;
  fontSize: number;
  lineHeightRatio: number;
  versions: Record<VersionKey, ReleaseConfig>;
  activeVersion: VersionKey;
  condition: LoadCondition;
  conditionPreset: string;
  thresholds: ClsThresholds;
  records: AcceptanceRecord[];
  notes: string;
  compare: boolean;
}

export function defaultDoc(): FontRelayDoc {
  return {
    language: 'de',
    containerWidth: 360,
    fontSize: 16,
    lineHeightRatio: 1.4,
    versions: { A: v1Config(), B: v2Config() },
    activeVersion: 'A',
    condition: { cacheHitSourceIds: [], slowdownFactor: 1, networkDown: false },
    conditionPreset: 'normal',
    thresholds: { ...DEFAULT_THRESHOLDS },
    records: [],
    notes: '',
    compare: false,
  };
}

export type DocAction =
  | { type: 'patch'; patch: Partial<FontRelayDoc> }
  | { type: 'patchConfig'; key: VersionKey; patch: Partial<ReleaseConfig> }
  | { type: 'replace'; doc: FontRelayDoc }
  | { type: 'addRecord'; record: AcceptanceRecord }
  | { type: 'removeRecord'; id: string }
  | { type: 'clearRecords' };

export function docReducer(doc: FontRelayDoc, action: DocAction): FontRelayDoc {
  switch (action.type) {
    case 'patch':
      return { ...doc, ...action.patch };
    case 'patchConfig':
      return {
        ...doc,
        versions: {
          ...doc.versions,
          [action.key]: { ...doc.versions[action.key], ...action.patch },
        },
      };
    case 'replace':
      return action.doc;
    case 'addRecord':
      return { ...doc, records: [action.record, ...doc.records].slice(0, 50) };
    case 'removeRecord':
      return { ...doc, records: doc.records.filter((r) => r.id !== action.id) };
    case 'clearRecords':
      return { ...doc, records: [] };
    default:
      return doc;
  }
}

/** 不可变更新当前激活版本配置 */
export function updateActiveConfig(
  doc: FontRelayDoc,
  fn: (c: ReleaseConfig) => ReleaseConfig,
): FontRelayDoc {
  const key = doc.activeVersion;
  return {
    ...doc,
    versions: { ...doc.versions, [key]: fn(doc.versions[key]) },
  };
}

const STORAGE_KEY = 'fontrelay.doc.v1';

export function loadDoc(): FontRelayDoc {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultDoc();
    const parsed = JSON.parse(raw) as Partial<FontRelayDoc>;
    // 浅合并，缺字段用默认值兜底（刷新恢复）
    const d = defaultDoc();
    return {
      ...d,
      ...parsed,
      versions: { A: parsed.versions?.A ?? d.versions.A, B: parsed.versions?.B ?? d.versions.B },
      condition: { ...d.condition, ...parsed.condition },
      thresholds: { ...d.thresholds, ...parsed.thresholds },
      records: parsed.records ?? [],
    };
  } catch {
    return defaultDoc();
  }
}

export function saveDoc(doc: FontRelayDoc): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
  } catch {
    // 隐私模式等场景下静默失败
  }
}
