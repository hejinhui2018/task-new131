// 默认字体、子集、语言样本与回退链 —— 复刻灰度时遇到的德语 / 越南语场景
import type {
  FallbackFont,
  FontConfig,
  LanguageSample,
  SubsetDef,
} from './types';

/** 常用字符范围（以去重字符串表示，便于交集计算） */
const R = {
  ascii: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz 0123456789.,:;!?-\'"()/@&',
  latinExt:
    'ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿĀāĂăĄą',
  /** 越南语特有带调元音 */
  vietnamese:
    'ĂăĐđĨĩŨũƠơƯưẠạẢảẤấẦầẨẩẪẫẬậẮắẰằẲẳẴẵẶặẸẹẺẻẼẽẾếỀềỂểỄễỆệỈỉỊịỌọỎỏỐốỒồỔổỖỗỘộỚớỜờỞởỠỡỢợỤụỦủỨứỪừỬửỮữỰựỲỳỴỵỶỷỸỹ',
  german: 'ÄäÖöÜüß',
  cyrillic: 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюяёЁ',
  cjk: '的一是不了人我在有他这为之大来以个中上们到说时地也子就道会要可你会品发布新字体验收台首页按钮立即预订了解更多',
};

export const DEFAULT_SUBSETS: SubsetDef[] = [
  { id: 'latin', label: 'latin（ASCII）', chars: R.ascii },
  { id: 'latin-ext', label: 'latin-ext（西欧扩展）', chars: R.latinExt },
  { id: 'vietnamese', label: 'vietnamese（越南语）', chars: R.vietnamese },
  { id: 'cyrillic', label: 'cyrillic（西里尔）', chars: R.cyrillic },
  { id: 'cjk', label: 'cjk（中日韩）', chars: R.cjk },
];

/** 系统回退链：复刻浏览器按字体逐个找字形的过程 */
export const DEFAULT_FALLBACKS: FallbackFont[] = [
  {
    id: 'sys-segoe',
    label: 'Segoe UI / San Francisco（系统无衬线）',
    family: 'system-ui',
    coverage: R.ascii + R.latinExt + R.german,
    metrics: { advance: 0.52, lineHeight: 1.2, xHeight: 0.52, weightWidth: 0.004 },
  },
  {
    id: 'sys-arial',
    label: 'Arial（拉丁回退）',
    family: 'Arial',
    coverage: R.ascii + R.latinExt + R.german,
    metrics: { advance: 0.56, lineHeight: 1.18, xHeight: 0.52, weightWidth: 0.006 },
  },
  {
    id: 'sys-tahoma',
    label: 'Tahoma（越南语回退）',
    family: 'Tahoma',
    coverage: R.ascii + R.vietnamese,
    metrics: { advance: 0.55, lineHeight: 1.22, xHeight: 0.51, weightWidth: 0.005 },
  },
  {
    id: 'sys-segoe-ui',
    label: 'Segoe UI（西里尔回退）',
    family: '"Segoe UI"',
    coverage: R.ascii + R.cyrillic,
    metrics: { advance: 0.53, lineHeight: 1.2, xHeight: 0.52, weightWidth: 0.004 },
  },
  {
    id: 'sys-pingfang',
    label: 'PingFang / Microsoft YaHei（中文回退）',
    family: '"PingFang SC","Microsoft YaHei"',
    coverage: R.cjk + R.ascii,
    metrics: { advance: 0.88, lineHeight: 1.35, xHeight: 0.56, weightWidth: 0.002 },
  },
  {
    id: 'sys-lastresort',
    label: 'LastResort（兜底 .notdef）',
    family: 'sans-serif',
    coverage: '', // 空集合 = 兜底，渲染缺失字形框
    metrics: { advance: 0.6, lineHeight: 1.2, xHeight: 0.5, weightWidth: 0 },
  },
];

export const LANGUAGES: LanguageSample[] = [
  {
    id: 'de',
    label: '德语（Deutsch）',
    texts: [
      {
        id: 'de-cta',
        label: '首屏主按钮',
        kind: 'button',
        text: 'Jetzt kostenlos herunterladen und ausprobieren',
        weight: 600,
        fontSize: 16,
      },
      {
        id: 'de-heading',
        label: '首屏标题',
        kind: 'heading',
        text: 'Schnelles, variables Schriftsystem für alle Märkte',
        weight: 700,
        fontSize: 40,
      },
      {
        id: 'de-body',
        label: '说明正文',
        kind: 'body',
        text: 'Die neue Schrift unterstützt automatisch alle Schriftgrade von 300 bis 800.',
        weight: 400,
        fontSize: 15,
      },
    ],
  },
  {
    id: 'vi',
    label: '越南语（Tiếng Việt）',
    texts: [
      {
        id: 'vi-heading',
        label: '首屏标题',
        kind: 'heading',
        text: 'Trải nghiệm thương hiệu với biến thể font chữ mới',
        weight: 700,
        fontSize: 38,
      },
      {
        id: 'vi-cta',
        label: '首屏主按钮',
        kind: 'button',
        text: 'Tải xuống miễn phí ngay bây giờ',
        weight: 600,
        fontSize: 16,
      },
      {
        id: 'vi-body',
        label: '说明正文',
        kind: 'body',
        text: 'Mỗi trọng lượng chữ được nội suy liên tục trên trục wght.',
        weight: 400,
        fontSize: 15,
      },
    ],
  },
  {
    id: 'en',
    label: '英语（English）',
    texts: [
      {
        id: 'en-heading',
        label: '首屏标题',
        kind: 'heading',
        text: 'A new variable type system for every market',
        weight: 700,
        fontSize: 40,
      },
      {
        id: 'en-cta',
        label: '首屏主按钮',
        kind: 'button',
        text: 'Download free and start creating',
        weight: 600,
        fontSize: 16,
      },
    ],
  },
  {
    id: 'zh',
    label: '中文（简体）',
    texts: [
      {
        id: 'zh-heading',
        label: '首屏标题',
        kind: 'heading',
        text: '面向全球市场的全新可变字体系统',
        weight: 700,
        fontSize: 38,
      },
      {
        id: 'zh-cta',
        label: '首屏主按钮',
        kind: 'button',
        text: '立即免费下载体验',
        weight: 600,
        fontSize: 16,
      },
    ],
  },
  {
    id: 'ru',
    label: '俄语（Русский）',
    texts: [
      {
        id: 'ru-heading',
        label: '首屏标题',
        kind: 'heading',
        text: 'Новая вариативная типографика для бренда',
        weight: 700,
        fontSize: 38,
      },
      {
        id: 'ru-cta',
        label: '首屏主按钮',
        kind: 'button',
        text: 'Скачать бесплатно',
        weight: 600,
        fontSize: 16,
      },
    ],
  },
];

/** 新字体（v2）度量：字面比系统回退略宽（德语按钮加载后多出换行的根因），行高更紧 */
const NEW_METRICS = {
  advance: 0.535,
  lineHeight: 1.14,
  xHeight: 0.54,
  weightWidth: 0.003,
};

/** 旧字体（v1）度量：更宽、行高更松，作为对比基线 */
const OLD_METRICS = {
  advance: 0.555,
  lineHeight: 1.17,
  xHeight: 0.52,
  weightWidth: 0.005,
};

function v2Config(): FontConfig {
  return {
    releaseName: 'v2 可变字体（新）',
    family: 'Brand Sans Variable',
    desiredWeight: 400,
    subsets: DEFAULT_SUBSETS.map((s) => ({ ...s, chars: s.chars })),
    files: [
      {
        id: 'v2-latin',
        label: 'BrandSans-VF.woff2 · latin',
        family: 'Brand Sans Variable',
        url: 'https://cdn.example.com/fonts/brand-sans/vf-latin.woff2',
        axis: { min: 300, max: 800, default: 400 },
        subsetIds: ['latin'],
        latencyMs: 420,
        metrics: NEW_METRICS,
        variable: true,
      },
      {
        id: 'v2-latin-ext',
        label: 'BrandSans-VF.woff2 · latin-ext',
        family: 'Brand Sans Variable',
        url: 'https://cdn.example.com/fonts/brand-sans/vf-latin-ext.woff2',
        axis: { min: 300, max: 800, default: 400 },
        subsetIds: ['latin-ext'],
        latencyMs: 640,
        metrics: NEW_METRICS,
        variable: true,
      },
      {
        id: 'v2-vietnamese',
        label: 'BrandSans-VF.woff2 · vietnamese',
        family: 'Brand Sans Variable',
        url: 'https://cdn.example.com/fonts/brand-sans/vf-vietnamese.woff2',
        axis: { min: 300, max: 800, default: 400 },
        subsetIds: ['vietnamese'],
        // 灰度里越南语子集被刻意延后，暴露“几个字符落系统字体”
        latencyMs: 1280,
        metrics: NEW_METRICS,
        variable: true,
      },
      {
        id: 'v2-cyrillic',
        label: 'BrandSans-VF.woff2 · cyrillic',
        family: 'Brand Sans Variable',
        url: 'https://cdn.example.com/fonts/brand-sans/vf-cyrillic.woff2',
        axis: { min: 300, max: 800, default: 400 },
        subsetIds: ['cyrillic'],
        latencyMs: 700,
        metrics: NEW_METRICS,
        variable: true,
      },
      // 注意：v2 没有 CJK 子集文件，中文将走系统回退
    ],
    fallbacks: DEFAULT_FALLBACKS.map((f) => ({ ...f })),
  };
}

function v1Config(): FontConfig {
  const base = v2Config();
  return {
    ...base,
    releaseName: 'v1 旧字体（基线）',
    family: 'Brand Sans',
    desiredWeight: 400,
    subsets: base.subsets.map((s) => ({ ...s, chars: s.chars })),
    files: [
      {
        id: 'v1-latin',
        label: 'BrandSans-Regular.woff2 · latin',
        family: 'Brand Sans',
        url: 'https://cdn.example.com/fonts/brand-sans/v1-latin.woff2',
        axis: { min: 400, max: 400, default: 400 },
        subsetIds: ['latin'],
        latencyMs: 380,
        metrics: OLD_METRICS,
        variable: false,
      },
      {
        id: 'v1-latin-ext',
        label: 'BrandSans-Regular.woff2 · latin-ext',
        family: 'Brand Sans',
        url: 'https://cdn.example.com/fonts/brand-sans/v1-latin-ext.woff2',
        axis: { min: 400, max: 400, default: 400 },
        subsetIds: ['latin-ext'],
        latencyMs: 520,
        metrics: OLD_METRICS,
        variable: false,
      },
      {
        id: 'v1-bold',
        label: 'BrandSans-Bold.woff2 · latin + latin-ext（粗体单独文件）',
        family: 'Brand Sans',
        url: 'https://cdn.example.com/fonts/brand-sans/v1-bold.woff2',
        axis: { min: 700, max: 700, default: 700 },
        subsetIds: ['latin', 'latin-ext'],
        latencyMs: 560,
        metrics: OLD_METRICS,
        variable: false,
      },
    ],
    fallbacks: base.fallbacks.map((f) => ({ ...f })),
  };
}

export const DEFAULT_CONFIGS: { a: FontConfig; b: FontConfig } = {
  a: v2Config(),
  b: v1Config(),
};

export const DEFAULT_CONDITIONS = {
  networkExtraMs: 0,
  failFiles: [],
  missingGlyphs: [],
  cachedUrls: [],
  duplicateInject: {},
};
