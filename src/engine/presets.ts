import type {
  LanguageCode,
  LoadCondition,
  ReleaseConfig,
  Scenario,
} from './types';

/**
 * 两个发布版本：
 * - v1 旧字体：静态字重、仅 latin 子集（越南语带调字符缺字）、字偏宽
 * - v2 新可变字体：可变 wght 轴、含越南语子集、字略窄 → 换字体后宽度/换行变化
 */

const baseFallbacks = [
  {
    id: 'fb-helvetica',
    family: 'Helvetica Neue',
    system: true,
    widthFactor: 1,
    lineHeightFactor: 1,
  },
  {
    id: 'fb-arial',
    family: 'Arial',
    system: true,
    widthFactor: 1.02,
    lineHeightFactor: 1.02,
  },
  {
    id: 'fb-sans',
    family: 'sans-serif',
    system: true,
    widthFactor: 1,
    lineHeightFactor: 1,
  },
];

export function v1Config(): ReleaseConfig {
  return {
    versionName: 'v1 旧静态字体',
    sources: [
      {
        id: 'v1-brand-regular',
        family: 'BrandSans',
        weight: 400,
        style: 'normal',
        subsets: ['ascii', 'latin1'],
        loadMs: 900,
        widthFactor: 1.06,
        lineHeightFactor: 1.0,
        note: '旧 Regular，只覆盖 latin，越南语带调字符缺字',
      },
      {
        id: 'v1-brand-bold',
        family: 'BrandSans',
        weight: 700,
        style: 'normal',
        subsets: ['ascii', 'latin1'],
        loadMs: 1100,
        widthFactor: 1.06,
        lineHeightFactor: 1.0,
        note: '旧 Bold 独立文件；按钮 600 字重会匹配到它',
      },
    ],
    stack: ['BrandSans', 'Helvetica Neue', 'Arial', 'sans-serif'],
    fallbacks: baseFallbacks,
    display: 'swap',
    blockPeriodMs: 100,
    swapPeriodMs: 3000,
    requestedWeight: 400,
    requestedStyle: 'normal',
  };
}

export function v2Config(): ReleaseConfig {
  return {
    versionName: 'v2 新可变字体',
    sources: [
      {
        id: 'v2-brand-vf',
        family: 'BrandSansVF',
        weight: [100, 900],
        style: 'normal',
        subsets: ['ascii', 'latin1', 'latinExtA', 'latinExtB', 'vietnamese'],
        loadMs: 1400,
        widthFactor: 0.94,
        lineHeightFactor: 0.98,
        variable: true,
        note: '可变字体单文件，覆盖越南语；字面略窄，可能改变换行',
      },
    ],
    stack: ['BrandSansVF', 'Helvetica Neue', 'Arial', 'sans-serif'],
    fallbacks: baseFallbacks,
    display: 'swap',
    blockPeriodMs: 100,
    swapPeriodMs: 3000,
    requestedWeight: 400,
    requestedStyle: 'normal',
  };
}

export function normalCondition(): LoadCondition {
  return {
    cacheHitSourceIds: [],
    slowdownFactor: 1,
    networkDown: false,
  };
}

export function makeScenario(input: {
  id?: string;
  name: string;
  config: ReleaseConfig;
  elements: Scenario['elements'];
  condition?: LoadCondition;
  containerWidth?: number;
  fontSize?: number;
  lineHeightRatio?: number;
}): Scenario {
  return {
    id: input.id ?? `sc-${Math.round(input.name.length * 1000)}-${input.config.sources.length}`,
    name: input.name,
    config: input.config,
    elements: input.elements,
    condition: input.condition ?? normalCondition(),
    containerWidth: input.containerWidth ?? 360,
    fontSize: input.fontSize ?? 16,
    lineHeightRatio: input.lineHeightRatio ?? 1.4,
  };
}

/** 常见故障条件预设 */
export const CONDITION_PRESETS: Array<{
  id: string;
  label: string;
  description: string;
  apply: (c: LoadCondition, sourceIds: string[]) => LoadCondition;
}> = [
  {
    id: 'normal',
    label: '正常网络',
    description: '所有文件按设定耗时加载',
    apply: (c) => ({ ...c, networkDown: false, slowdownFactor: 1 }),
  },
  {
    id: 'slow',
    label: '慢网 3G',
    description: '加载耗时 ×4，暴露 block/swap 过程',
    apply: (c) => ({ ...c, slowdownFactor: 4, networkDown: false, cacheHitSourceIds: [] }),
  },
  {
    id: 'cache',
    label: '缓存命中',
    description: '字体文件全部命中缓存，首屏即最终态',
    apply: (c, ids) => ({ ...c, cacheHitSourceIds: ids, slowdownFactor: 1, networkDown: false }),
  },
  {
    id: 'fail-file',
    label: '文件失败',
    description: '在源配置中勾选 fail 的文件将加载失败（保持其余正常）',
    apply: (c) => ({ ...c, networkDown: false, slowdownFactor: 1 }),
  },
  {
    id: 'network-down',
    label: '网络断开',
    description: '所有 web 字体失败，全程系统回退',
    apply: (c) => ({ ...c, networkDown: true, cacheHitSourceIds: [] }),
  },
];

export const WIDTH_PRESETS: Array<{ label: string; width: number }> = [
  { label: '手机 360', width: 360 },
  { label: '窄按钮容器 280', width: 280 },
  { label: '平板 768', width: 768 },
  { label: '桌面 1080', width: 1080 },
];

export const LANGUAGE_LABEL: Record<LanguageCode, string> = {
  zh: '中文',
  de: 'Deutsch',
  vi: 'Tiếng Việt',
  en: 'English',
};
