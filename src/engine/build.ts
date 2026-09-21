import type { FontRelayDoc, VersionKey } from '../state/store';
import { makeScenario } from './presets';
import { makeElements } from './languages';
import type { Scenario } from './types';

/** 由文档与版本键构造仿真场景 */
export function buildScenario(doc: FontRelayDoc, key: VersionKey): Scenario {
  return makeScenario({
    id: `scenario-${key}`,
    name: `${doc.versions[key].versionName} / ${doc.language} / ${doc.containerWidth}px`,
    config: doc.versions[key],
    elements: makeElements(doc.language),
    condition: doc.condition,
    containerWidth: doc.containerWidth,
    fontSize: doc.fontSize,
    lineHeightRatio: doc.lineHeightRatio,
  });
}
