// 两个发布版本的逐步对比：定位第一次视觉变化
import type {
  ElementDiff,
  ElementSnapshot,
  RunResult,
  StepDiff,
  VersionCompare,
} from './types';

function diffElement(a: ElementSnapshot, bb: ElementSnapshot): ElementDiff {
  const fontChangedChars: number[] = [];
  const len = Math.max(a.chars.length, bb.chars.length);
  for (let i = 0; i < len; i++) {
    const ca = a.chars[i];
    const cb = bb.chars[i];
    if (!ca || !cb || ca.family !== cb.family || ca.fileId !== cb.fileId || ca.missing !== cb.missing) {
      fontChangedChars.push(i);
    }
  }
  return {
    textId: a.textId,
    label: a.label,
    changed:
      a.height !== bb.height ||
      a.width !== bb.width ||
      a.lines.length !== bb.lines.length ||
      fontChangedChars.length > 0,
    heightDelta: Math.round((bb.height - a.height) * 10) / 10,
    widthDelta: Math.round((bb.width - a.width) * 10) / 10,
    linesDelta: bb.lines.length - a.lines.length,
    fontChangedChars,
  };
}

function pairSteps(a: RunResult, b: RunResult): StepDiff[] {
  // 以版本 A（通常为新版本）时间线为基准，按步骤索引对齐两个版本；
  // B 步骤数不同时取同位索引，末尾复用各自稳定态。
  const n = Math.max(a.steps.length, b.steps.length);
  const out: StepDiff[] = [];
  for (let i = 0; i < n; i++) {
    const sa = a.steps[i] ?? a.steps[a.steps.length - 1];
    const sb = b.steps[i] ?? b.steps[b.steps.length - 1];
    const elements: ElementDiff[] = sa.elements.map((ea, idx) => {
      const eb = sb.elements[idx];
      if (!eb) {
        return {
          textId: ea.textId,
          label: ea.label,
          changed: false,
          heightDelta: 0,
          widthDelta: 0,
          linesDelta: 0,
          fontChangedChars: [],
        };
      }
      return diffElement(ea, eb);
    });
    out.push({
      t: sa.t,
      changed: elements.some((e) => e.changed),
      elements,
    });
  }
  return out;
}

/** 对比两次运行（a 通常为新版本，b 为旧版本基线） */
export function compareRuns(a: RunResult, b: RunResult): VersionCompare {
  const steps = pairSteps(a, b);
  let firstVisualStepIndex: number | null = null;
  let firstVisualChangeAt: number | null = null;
  // “视觉变化” = 几何（高/宽/行数）发生改变；纯字体切换但无几何差异不算视觉跳动
  for (let i = 0; i < steps.length; i++) {
    const geometric = steps[i].elements.some(
      (e) => e.changed && (e.heightDelta !== 0 || e.widthDelta !== 0 || e.linesDelta !== 0),
    );
    if (geometric) {
      firstVisualStepIndex = i;
      firstVisualChangeAt = steps[i].t;
      break;
    }
  }
  const settledA = a.steps[a.settledStepIndex] ?? a.steps[a.steps.length - 1];
  const settledB = b.steps[b.settledStepIndex] ?? b.steps[b.steps.length - 1];
  const heightA = settledA.elements.reduce((s, e) => s + e.height, 0);
  const heightB = settledB.elements.reduce((s, e) => s + e.height, 0);

  return {
    firstVisualChangeAt,
    firstVisualStepIndex,
    steps,
    settledHeightDelta: Math.round((heightA - heightB) * 10) / 10,
    settledClsDelta: Math.round((a.cls - b.cls) * 10000) / 10000,
    settledFallbackDelta: a.fellBackChars - b.fellBackChars,
  };
}
