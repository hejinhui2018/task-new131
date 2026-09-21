// 应用状态：可撤销文档（两个发布版本 + 全局加载条件）、验收记录、持久字体缓存
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  commit as historyCommit,
  initHistory,
  redo as historyRedo,
  undo as historyUndo,
  canRedo,
  canUndo,
  type History,
} from '../core/history';
import { DEFAULT_CONDITIONS, DEFAULT_CONFIGS, LANGUAGES } from '../core/presets';
import type {
  AcceptanceRecord,
  FontConfig,
  LoadConditions,
} from '../core/types';

export interface DocState {
  configA: FontConfig;
  configB: FontConfig;
  /** 单版本视图正在查看哪个版本 */
  activeRelease: 'a' | 'b';
  conditions: LoadConditions;
  languageId: string;
  containerWidth: number;
  /** 对比模式开关 */
  compareMode: boolean;
}

interface PersistShape {
  doc: DocState;
  records: AcceptanceRecord[];
  cacheUrls: string[];
}

const STORAGE_KEY = 'fontrelay:v1';

export function defaultDoc(): DocState {
  return {
    configA: structuredClone(DEFAULT_CONFIGS.a),
    configB: structuredClone(DEFAULT_CONFIGS.b),
    activeRelease: 'a',
    conditions: structuredClone(DEFAULT_CONDITIONS),
    languageId: LANGUAGES[0].id,
    containerWidth: 320,
    compareMode: false,
  };
}

function loadPersisted(): PersistShape {
  const fallback: PersistShape = { doc: defaultDoc(), records: [], cacheUrls: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as PersistShape;
    // 简单结构校验，失败则回退默认（版本不兼容时不阻断使用）
    if (!parsed.doc?.configA?.files || !parsed.doc?.configB?.files) return fallback;
    return {
      doc: { ...defaultDoc(), ...parsed.doc },
      records: Array.isArray(parsed.records) ? parsed.records : [],
      cacheUrls: Array.isArray(parsed.cacheUrls) ? parsed.cacheUrls : [],
    };
  } catch {
    return fallback;
  }
}

export interface StoreValue {
  doc: DocState;
  history: History<DocState>;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** 用更新函数编辑文档并压入撤销栈 */
  editDoc: (updater: (draft: DocState) => DocState) => void;
  activeConfig: FontConfig;
  editActiveConfig: (updater: (c: FontConfig) => FontConfig) => void;
  records: AcceptanceRecord[];
  addRecord: (r: AcceptanceRecord) => void;
  removeRecord: (id: string) => void;
  clearRecords: () => void;
  cacheUrls: string[];
  warmCache: (urls: string[]) => void;
  clearCache: () => void;
  cacheMode: 'cold' | 'warm';
  setCacheMode: (m: 'cold' | 'warm') => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const initial = useRef(loadPersisted());
  const [history, setHistory] = useState<History<DocState>>(() =>
    initHistory(initial.current.doc),
  );
  const [records, setRecords] = useState<AcceptanceRecord[]>(initial.current.records);
  const [cacheUrls, setCacheUrls] = useState<string[]>(initial.current.cacheUrls);
  const [cacheMode, setCacheMode] = useState<'cold' | 'warm'>('cold');

  const doc = history.present;

  const editDoc = useCallback((updater: (draft: DocState) => DocState) => {
    setHistory((h) => {
      const next = updater(structuredClone(h.present));
      return historyCommit(h, next);
    });
  }, []);

  const undo = useCallback(() => setHistory((h) => historyUndo(h)), []);
  const redo = useCallback(() => setHistory((h) => historyRedo(h)), []);

  // 刷新恢复：文档 / 记录 / 缓存写入 localStorage
  const persistValue = useMemo(
    () => JSON.stringify({ doc: history.present, records, cacheUrls }),
    [history.present, records, cacheUrls],
  );
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, persistValue);
    } catch {
      /* 存储不可用时静默降级 */
    }
  }, [persistValue]);

  const activeConfig = doc.activeRelease === 'a' ? doc.configA : doc.configB;
  const editActiveConfig = useCallback(
    (updater: (c: FontConfig) => FontConfig) => {
      editDoc((d) => {
        const key = d.activeRelease === 'a' ? 'configA' : 'configB';
        return { ...d, [key]: updater(structuredClone(d[key])) };
      });
    },
    [editDoc],
  );

  const value: StoreValue = {
    doc,
    history,
    undo,
    redo,
    canUndo: canUndo(history),
    canRedo: canRedo(history),
    editDoc,
    activeConfig,
    editActiveConfig,
    records,
    addRecord: (r) => setRecords((rs) => [r, ...rs]),
    removeRecord: (id) => setRecords((rs) => rs.filter((x) => x.id !== id)),
    clearRecords: () => setRecords([]),
    cacheUrls,
    warmCache: (urls) =>
      setCacheUrls((prev) => Array.from(new Set([...prev, ...urls]))),
    clearCache: () => setCacheUrls([]),
    cacheMode,
    setCacheMode,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore 必须在 StoreProvider 内使用');
  return ctx;
}
