// 字体文件加载仿真：网络耗时、失败、缓存命中、重复注入
import type { FontFile, InjectionRecord, LoadConditions } from './types';

export interface LoadEvent {
  type: 'load' | 'fail';
  fileId: string;
  url: string;
  /** 完成时刻（相对开始 ms）；缓存命中为 0 */
  t: number;
}

/**
 * 规划一次运行里所有文件的加载事件。
 * - 缓存命中的 URL：t=0 立即可用，不产生网络请求
 * - 失败文件：在延迟后产生 fail 事件
 * - 重复注入：同 URL 被注入 N 次，只有第一次真正请求，其余记录为冗余注入
 */
export function planLoads(
  files: FontFile[],
  conditions: LoadConditions,
): { events: LoadEvent[]; injections: InjectionRecord[] } {
  const events: LoadEvent[] = [];
  const injections: InjectionRecord[] = [];
  const seenUrl = new Map<string, number>();

  // 先记录注入（t≈0，页面解析样式时逐个插入）
  files.forEach((file, order) => {
    const times = Math.max(1, conditions.duplicateInject[file.url] ?? 1);
    for (let k = 0; k < times; k++) {
      const seq = (seenUrl.get(file.url) ?? 0) + 1;
      seenUrl.set(file.url, seq);
      injections.push({
        t: order, // 注入按文件声明顺序错开 1ms，仅为可读
        url: file.url,
        fileId: file.id,
        sequence: seq,
        redundant: seq > 1,
      });
    }
  });

  for (const file of files) {
    const cached = conditions.cachedUrls.includes(file.url);
    if (cached) {
      events.push({ type: 'load', fileId: file.id, url: file.url, t: 0 });
      continue;
    }
    if (conditions.failFiles.includes(file.id)) {
      // 失败也要等一个网络往返才暴露
      events.push({
        type: 'fail',
        fileId: file.id,
        url: file.url,
        t: file.latencyMs + conditions.networkExtraMs,
      });
      continue;
    }
    events.push({
      type: 'load',
      fileId: file.id,
      url: file.url,
      t: file.latencyMs + conditions.networkExtraMs,
    });
  }
  return { events, injections };
}

/** 缓存存储：仿真浏览器的字体缓存（键为 URL）。刷新后仍命中 */
export class FontCache {
  private urls = new Set<string>();

  constructor(initial: string[] = []) {
    initial.forEach((u) => this.urls.add(u));
  }

  has(url: string): boolean {
    return this.urls.has(url);
  }

  add(url: string): void {
    this.urls.add(url);
  }

  /** 成功加载的文件写入缓存；失败不写 */
  absorb(events: LoadEvent[]): void {
    for (const e of events) if (e.type === 'load') this.add(e.url);
  }

  values(): string[] {
    return [...this.urls];
  }

  clear(): void {
    this.urls.clear();
  }
}
