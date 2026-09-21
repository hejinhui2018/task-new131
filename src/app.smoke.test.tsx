import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import App from './App';

describe('应用冒烟（SSR 渲染组件树）', () => {
  it('App 在无 localStorage 的环境下也能完整渲染', () => {
    const html = renderToString(<App />);
    expect(html).toContain('Web 字体发布验收台');
    // 首屏：时间线与关键指标都应出现
    expect(html).toContain('首屏');
    expect(html).toContain('累计布局偏移');
    // 德语样本的元素标签存在（舞台正文按字符 span 拆分渲染）
    expect(html).toContain('首屏主按钮');
    expect(html).toContain('首屏标题');
  });

  it('两次渲染结果稳定（无状态污染）', () => {
    const a = renderToString(<App />);
    const b = renderToString(<App />);
    expect(a).toBe(b);
  });
});
