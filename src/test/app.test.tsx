import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import App from '../App';

describe('FontRelay App — UI 冒烟与关键交互', () => {
  it('首屏渲染：舞台、时间线、字体配置、验收面板都在', () => {
    render(<App />);
    expect(screen.getByText('FontRelay')).toBeTruthy();
    expect(screen.getByTestId('stage')).toBeTruthy();
    expect(screen.getByText(/时间线回放/)).toBeTruthy();
    expect(screen.getByText(/验收判定/)).toBeTruthy();
    // 默认 v1 旧字体 900/1100ms，首屏帧显示 0ms
    expect(screen.getByText(/t=0ms/)).toBeTruthy();
  });

  it('单步前进到字体加载帧：出现“已偏离首屏”，事件流包含字体到达', () => {
    render(<App />);
    const step = screen.getByText('单步 →');
    // 帧：0(block) → 100(block end reveal) → 900 → 1100(stable)
    fireEvent.click(step); // 100ms
    fireEvent.click(step); // 900ms
    expect(screen.getByText(/t=900ms/)).toBeTruthy();
    // 已偏离首屏徽标出现，且事件流记录 BrandSans 到达
    expect(screen.getByText('已偏离首屏')).toBeTruthy();
    expect(screen.getAllByText(/BrandSans 加载完成/).length).toBeGreaterThan(0);
  });

  it('切换到越南语 + v2 版本：最终帧无缺字', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '版本 B' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tiếng Việt' }));
    // 跳到最后一帧
    const frames = document.querySelectorAll('.fframe');
    fireEvent.click(frames[frames.length - 1]);
    expect(screen.getAllByText(/0 个缺字/).length).toBeGreaterThan(0);
    // 舞台上没有 .notdef 豆腐块
    expect(document.querySelectorAll('.glyph.missing').length).toBe(0);
  });

  it('保存验收记录后记录列表出现，并可导出 JSON 按钮', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '保存验收记录' }));
    const heading = screen.getByRole('heading', { name: /验收记录（1）/ });
    const panel = heading.closest('.panel')!;
    expect(within(panel as HTMLElement).getByText('JSON')).toBeTruthy();
  });

  it('撤销按钮在配置修改后可用，撤销恢复状态', () => {
    render(<App />);
    const undoBtn = screen.getByTitle('撤销 (Ctrl+Z)') as HTMLButtonElement;
    expect(undoBtn.disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(undoBtn.disabled).toBe(false);
    fireEvent.click(undoBtn);
    expect((screen.getByTitle('撤销 (Ctrl+Z)') as HTMLButtonElement).disabled).toBe(true);
  });

  it('A/B 对比视图打开并显示双舞台与“第一次版本差异”', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'A/B 版本对比' }));
    expect(screen.getAllByText(/版本对比 · 共享时间轴|第一次版本差异/).length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('stage').length).toBe(2);
  });
});
