// 由当前文档派生一次（或两次）仿真运行
import { useMemo } from 'react';
import { runRelay } from '../core/relay';
import { FontCache } from '../core/loader';
import { compareRuns } from '../core/compare';
import { useStore } from './store';

export function useRuns() {
  const { doc, cacheUrls, cacheMode } = useStore();

  return useMemo(() => {
    const makeParams = (which: 'a' | 'b') => ({
      config: which === 'a' ? doc.configA : doc.configB,
      conditions: doc.conditions,
      containerWidth: doc.containerWidth,
      languageId: doc.languageId,
    });

    // 热缓存模式：把持久缓存传入（仿真刷新后二次访问）
    const cache = cacheMode === 'warm' ? new FontCache(cacheUrls) : new FontCache(doc.conditions.cachedUrls);
    const runA = runRelay(makeParams('a'), cache);
    const runB = runRelay(makeParams('b'), new FontCache(cacheMode === 'warm' ? cacheUrls : doc.conditions.cachedUrls));
    const compare = compareRuns(runA, runB);
    return { runA, runB, compare };
  }, [doc, cacheUrls, cacheMode]);
}
