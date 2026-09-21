/**
 * FontRelay 核心领域模型
 */

/** 可变轴定义（当前支持 wght 字重轴） */
export interface AxisRange {
  /** 轴标签，如 wght */
  tag: 'wght';
  min: number;
  max: number;
  /** 默认（实例）值 */
  default: number;
}

export type FontStyle = 'normal' | 'italic';

/** 字符子集标识，或直接给 unicode 范围 */
export interface SubsetDef {
  id: string;
  label: string;
  /** unicode 码点区间（闭区间），命中其一即属于该子集 */
  ranges: Array<[number, number]>;
}

/** 一个字体文件（@font-face 候选） */
export interface FontSource {
  id: string;
  /** family 名，如 Brand Sans Variable */
  family: string;
  /** 字重：静态数字，或可变区间 [min,max] */
  weight: number | [number, number];
  style: FontStyle;
  /** 该文件实际覆盖的子集 id 列表 */
  subsets: string[];
  /** 额外覆盖的码点区间（如手动补充 ấ 等） */
  extraRanges?: Array<[number, number]>;
  /** 模拟下载耗时 ms */
  loadMs: number;
  /** 文件失败：加载到一半报错 */
  fail?: boolean;
  /** 注入次数（重复注入故障：>1 表示同一文件被注入多次） */
  injections?: number;
  /** 相对宽度系数：新字体相对回退字体的字符宽度（1 = 等宽） */
  widthFactor: number;
  /** 相对行高系数 */
  lineHeightFactor: number;
  /** 是否可变字体（weight 为区间时自动视为可变） */
  variable?: boolean;
  /** 备注 */
  note?: string;
}

/** 回退栈中的一项 */
export interface FallbackFamily {
  id: string;
  family: string;
  /** 系统字体始终可用；web 回退字体也需加载 */
  system: boolean;
  loadMs?: number;
  fail?: boolean;
  widthFactor: number;
  lineHeightFactor: number;
  /** 覆盖码点区间；system 字体默认覆盖所有 BMP 字符 */
  coverage?: Array<[number, number]>;
}

/** font-display 策略 */
export type FontDisplay = 'auto' | 'block' | 'swap' | 'fallback' | 'optional';

/** 发布配置 */
export interface ReleaseConfig {
  /** 发布版本名 */
  versionName: string;
  sources: FontSource[];
  /** font-family 栈顺序（从首选到回退） */
  stack: string[];
  fallbacks: FallbackFamily[];
  display: FontDisplay;
  /** block 期时长 ms（浏览器约 3s，验收台可配） */
  blockPeriodMs: number;
  /** swap/fallback 期时长 ms */
  swapPeriodMs: number;
  /** 请求的字重（标题/正文等元素分别指定，元素级覆盖） */
  requestedWeight: number;
  requestedStyle: FontStyle;
}

export type LanguageCode = 'zh' | 'de' | 'vi' | 'en';

/** 舞台元素 */
export interface StageElementSpec {
  id: string;
  kind: 'title' | 'body' | 'button';
  language: LanguageCode;
  text: string;
  /** 元素级字重，缺省用 config.requestedWeight */
  weight?: number;
  style?: FontStyle;
  /** 元素自身左右内边距 px */
  paddingX?: number;
  /** 按钮有固定最大宽度（模拟 CTA 容器） */
  maxWidth?: number;
}

/** 加载/网络条件 */
export interface LoadCondition {
  /** 缓存命中的 source id 列表（命中 0ms 立即可用） */
  cacheHitSourceIds: string[];
  /** 全局延迟倍乘（慢网），1=正常 */
  slowdownFactor: number;
  /** 强制所有文件失败（网络断开） */
  networkDown: boolean;
}

export interface Scenario {
  id: string;
  name: string;
  config: ReleaseConfig;
  elements: StageElementSpec[];
  condition: LoadCondition;
  /** 舞台（容器）宽度 px */
  containerWidth: number;
  fontSize: number;
  lineHeightRatio: number;
}

/** 单个码点的匹配结果 */
export interface GlyphMatch {
  char: string;
  codePoint: number;
  /** 实际命中的 family */
  family: string;
  sourceId?: string;
  fallbackId?: string;
  /** 是否缺失字形（落到 .notdef / tofu） */
  missing: boolean;
  /** 命中时使用的字重（可变轴实例值） */
  usedWeight: number;
  /** 宽度 px */
  width: number;
  /** 相对首选字体的宽度（用于渲染） */
  factor: number;
  /** block 隐形期内占位但不显示字形 */
  invisible?: boolean;
}

export interface LaidLine {
  glyphs: GlyphMatch[];
  width: number;
  /** 是否因为放不下而换行（非最后一行） */
  wrapped: boolean;
}

export interface ElementLayoutSnapshot {
  elementId: string;
  lines: LaidLine[];
  width: number;
  height: number;
  lineCount: number;
  /** 缺字数量 */
  missingCount: number;
  /** 使用了的 family 列表（去重，按出现顺序） */
  familiesUsed: string[];
}

export type EventKind =
  | 'first-paint'
  | 'cache-hit'
  | 'load-start'
  | 'font-load'
  | 'font-fail'
  | 'swap'
  | 'fallback-load'
  | 'block-end'
  | 'stable'
  | 'duplicate-injection'
  | 'repeat-run';

export interface TimelineEvent {
  t: number;
  kind: EventKind;
  message: string;
  sourceId?: string;
  family?: string;
}

export interface FrameSnapshot {
  /** 帧时间 ms */
  t: number;
  /** 阶段 */
  phase: 'block' | 'swap' | 'stable';
  /** 当前已可用 source id */
  loadedSources: string[];
  /** 当前已失败 source id */
  failedSources: string[];
  /** 已加载的回退 id */
  loadedFallbacks: string[];
  /** 元素布局 */
  elements: ElementLayoutSnapshot[];
  /** 距上一帧的布局偏移分数（CLS 增量） */
  clsDelta: number;
  /** 累计 CLS */
  cls: number;
  /** 是否与首帧相比发生视觉变化 */
  changedFromFirst: boolean;
}

export interface SimulationResult {
  frames: FrameSnapshot[];
  events: TimelineEvent[];
  /** 首次视觉变化帧下标（-1 = 全程无变化） */
  firstVisualChangeFrame: number;
  /** 首次视觉变化时间 ms */
  firstVisualChangeAt: number;
  finalCls: number;
  stableAt: number;
  missingGlyphs: Array<{ elementId: string; char: string; codePoint: number; family: string }>;
  /** 重复注入检测记录 */
  duplicateInjections: Array<{ sourceId: string; family: string; times: number }>;
  /** 运行指纹：相同输入重复运行必须一致 */
  fingerprint: string;
}

/** 验收记录 */
export interface AcceptanceRecord {
  id: string;
  createdAt: string;
  scenarioName: string;
  versionName: string;
  language: string;
  containerWidth: number;
  passed: boolean;
  /** 验收门槛 */
  thresholds: ClsThresholds;
  metrics: {
    finalCls: number;
    firstVisualChangeAt: number;
    stableAt: number;
    missingCount: number;
    lineCountMax: number;
    familiesUsed: string[];
  };
  notes?: string;
}

export interface ClsThresholds {
  maxCls: number;
  maxMissingGlyphs: number;
  maxStableMs: number;
}
