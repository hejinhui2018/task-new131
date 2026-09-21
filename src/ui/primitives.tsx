import type { ReactNode } from 'react';

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="panel">
      <h2>
        {title}
        {action && <span style={{ float: 'right' }}>{action}</span>}
      </h2>
      {children}
    </div>
  );
}

export function NumberField({
  label, value, onChange, min, max, step, width,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  width?: number;
}) {
  return (
    <label className="field">
      {label}
      <input
        type="number"
        style={width ? { width } : undefined}
        value={Number.isFinite(value) ? value : ''}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(v);
        }}
      />
    </label>
  );
}

export function TextField({
  label, value, onChange, width,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  width?: number;
}) {
  return (
    <label className="field">
      {label}
      <input type="text" style={width ? { width } : undefined} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function Badge({ tone, children }: { tone?: 'ok' | 'bad' | 'warn' | 'brand'; children: ReactNode }) {
  const bg = {
    ok: 'var(--ok-bg)',
    bad: 'var(--bad-bg)',
    warn: 'var(--warn-bg)',
    brand: 'var(--brand-soft)',
  }[tone ?? 'brand'];
  const color = {
    ok: 'var(--ok)',
    bad: 'var(--bad)',
    warn: 'var(--warn)',
    brand: 'var(--brand)',
  }[tone ?? 'brand'];
  return (
    <span style={{ background: bg, color, borderRadius: 999, padding: '1px 8px', fontSize: 11, fontWeight: 600 }}>
      {children}
    </span>
  );
}
