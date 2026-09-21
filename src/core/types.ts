// FontRelay 核心类型定义

/** 可变字体字重轴（wght）范围 */
export interface WeightAxis {
  /** 轴最小值 */
  min: number;
  /** 轴最大值 */
  max: number;
  /** 默认（normal）实例值 */
  default: number;
}

/** 字符子集定义 */
export interface SubsetDef {
  id: string;
  label: string;
  /** 该子集覆盖的字符集合（去重字符串） */
  chars: string;
}

/** 一个字体文件（@font-face 对应物） */
export interface FontFile {
  id: string;
  label: string;
  /** 所属 font-family */
  family: string;
  /** 远程 URL（仿真用，作为缓存键） */
  url: string;
  /** 字重轴；无轴字体用单点 min===max===default */
  axis: WeightAxis;
  /** 该文件包含的子集 id 列表 */
  subsetIds: string[];
  /** 网络往返耗时 ms（慢加载通过这里或故障条件模拟） */
  latencyMs: number;
  /** 字形相对度量，1 = 与系统基准相同 */
  metrics: FontMetrics;
  /** 是否为可变字体（影响轴是否可插值到任意字重） */
  variable: boolean;
}

/** 字体度量：决定换行与几何，数值均相对系统无衬线基准 */
export interface FontMetrics {
  /** 平均字符前进宽度系数 */
  advance: number;
  /** 每 em 行高系数 */
  lineHeight: number;
  /** x 高度系数 */
  xHeight: number;
  /** 字重对宽度的附加影响，每偏离默认字重 100 的系数 */
  weightWidth: number;
}

/** 回退链中的一个系统字体 */
export interface FallbackFont {
  id: string;
  label: string;
  family: string;
  /** 支持的 Unicode 范围（字符集合，空表示兜底全支持） */
  coverage: string;
  metrics: FontMetrics;
}

/** 发布版本里的字体策略配置 */
export interface FontConfig {
  /** 发布版本名，如 v1 / v2 */
  releaseName: string;
  family: string;
  /** 期望渲染字重 */
  desiredWeight: number;
  files: FontFile[];
  subsets: SubsetDef[];
  /** 回退顺序：排在越前越优先 */
  fallbacks: FallbackFont[];
}

/** 语言样本 */
export interface LanguageSample {
  id: string;
  label: string;
  /** 按钮 / 标题等真实文本 */
  texts: SampleText[];
}

export interface SampleText {
  id: string;
  label: string;
  /** 标题 | 按钮 | 正文 */
  kind: 'heading' | 'button' | 'body';
  text: string;
  /** 该元素使用的字重 */
  weight: number;
  /** 字号 px */
  fontSize: number;
}

/** 网络 / 故障条件 */
export interface LoadConditions {
  /** 网络延迟附加量 ms */
  networkExtraMs: number;
  /** 强制失败的文件 id 集合 */
  failFiles: string[];
  /** 强制缺失字形：这些字符即使子集声明覆盖也算缺字 */
  missingGlyphs: string[];
  /** 缓存命中：命中的 URL 在运行开始前即已就绪 */
  cachedUrls: string[];
  /** 重复注入：同 URL 被注入次数（>1 表示页面重复插入了 @font-face/link） */
  duplicateInject: Record<string, number>;
}

/** 运行参数 */
export interface RunParams {
  config: FontConfig;
  conditions: LoadConditions;
  /** 容器宽度 px */
  containerWidth: number;
  languageId: string;
}

/** 单个字符的匹配结果 */
export interface CharMatch {
  /** 在文本中的下标 */
  index: number;
  char: string;
  /** 实际用于绘制的 family */
  family: string;
  /** 实际文件 id；系统回退时为 null */
  fileId: string | null;
  /** 来源：web 自定义字体 / 系统回退 */
  source: 'web' | 'system';
  /** 是否触发缺失字形（.notdef 豆腐块由回退字体兜住时也算） */
  missing: boolean;
  /** 字重是否被轴支持（不支持则回退到最接近边界值） */
  weightSynthesized: boolean;
  /** 该字符前进宽度 px */
  width: number;
}

/** 时间线上一个元素的快照 */
export interface ElementSnapshot {
  textId: string;
  label: string;
  kind: SampleText['kind'];
  weight: number;
  fontSize: number;
  /** 逐字符匹配 */
  chars: CharMatch[];
  /** 布局后的行盒子 */
  lines: LayoutLine[];
  /** 总宽高（含多行） */
  width: number;
  height: number;
  /** 换行点（在第几个字符后折行，按 index 计） */
  breakAfter: number[];
}

export interface LayoutLine {
  /** 行内字符下标区间（相对元素文本） */
  start: number;
  end: number;
  text: string;
  width: number;
  height: number;
}

/** 时间线步骤 */
export interface TimelineStep {
  /** 毫秒时间戳，相对运行开始 */
  t: number;
  /** 步骤类型 */
  type: 'init' | 'inject' | 'load' | 'fail' | 'cache-hit' | 'dup-inject' | 'settle';
  fileId?: string;
  url?: string;
  /** 此刻已就绪的 web 文件 id 集合 */
  readyFileIds: string[];
  /** 此刻全部元素快照 */
  elements: ElementSnapshot[];
  note: string;
}

/** 一次完整运行的结果 */
export interface RunResult {
  steps: TimelineStep[];
  /** 稳定（最后一步）索引 */
  settledStepIndex: number;
  /** 布局偏移事件 */
  shifts: LayoutShift[];
  /** 本次运行的注入日志（用于检测重复注入） */
  injections: InjectionRecord[];
  /** 是否有文件加载失败 */
  failedFiles: string[];
  /** 是否有字符最终仍落在系统字体（含缺字） */
  fellBackChars: number;
  /** 总 CLS（累计布局偏移分数） */
  cls: number;
}

export interface LayoutShift {
  t: number;
  textId: string;
  label: string;
  /** 高度变化 px */
  deltaHeight: number;
  /** 宽度变化 px */
  deltaWidth: number;
  /** 行数变化 */
  deltaLines: number;
  /** 受影响字符数 */
  affectedChars: number;
  /** 该事件贡献的偏移分数（按视口面积归一） */
  score: number;
  reason: string;
}

export interface InjectionRecord {
  t: number;
  url: string;
  fileId: string;
  /** 这是该 URL 第几次注入 */
  sequence: number;
  /** 是否为重复（冗余）注入 */
  redundant: boolean;
}

/** 两个版本某一步的对比 */
export interface StepDiff {
  t: number;
  changed: boolean;
  /** 元素级变化 */
  elements: ElementDiff[];
}

export interface ElementDiff {
  textId: string;
  label: string;
  changed: boolean;
  heightDelta: number;
  linesDelta: number;
  /** 匹配字体发生变化的字符下标 */
  fontChangedChars: number[];
  widthDelta: number;
}

/** 版本对比结果 */
export interface VersionCompare {
  /** 第一次出现视觉差异的时间点；null 表示始终一致 */
  firstVisualChangeAt: number | null;
  /** 第一次差异所在步骤（旧版本步骤索引） */
  firstVisualStepIndex: number | null;
  steps: StepDiff[];
  /** 稳定态总差异 */
  settledHeightDelta: number;
  settledClsDelta: number;
  settledFallbackDelta: number;
}

/** 验收记录（可导出） */
export interface AcceptanceRecord {
  id: string;
  createdAt: string;
  releaseName: string;
  languageId: string;
  containerWidth: number;
  conditions: LoadConditions;
  cls: number;
  maxShift: LayoutShift | null;
  fellBackChars: number;
  failedFiles: string[];
  redundantInjections: number;
  settledAtMs: number;
  passed: boolean;
  notes?: string;
  /** 对比版本时附带 */
  comparedWith?: string;
  firstVisualChangeAt: number | null;
}
