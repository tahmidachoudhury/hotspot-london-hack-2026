import { useState, type CSSProperties } from 'react';
import { pal } from './palette';
import { ACCENT } from './VideoCard';

const p = pal('Paper');

type Style = CSSProperties & Record<string, unknown>;

const S: Record<string, Style> = {
  wrap: { position: 'relative', flex: '1 1 auto', maxWidth: '560px', margin: '0 auto' },
  pill: {
    display: 'flex',
    alignItems: 'center',
    gap: '9px',
    height: '44px',
    padding: '0 18px',
    borderRadius: '999px',
    background: p.panel,
    border: '1px solid ' + p.line,
    boxShadow: 'inset 0 1px 2px rgba(0,0,0,.03)',
  },
  icon: { fontSize: '19px', color: p.faint, lineHeight: 1 },
  input: { flex: 1, border: 'none', outline: 'none', background: 'transparent', font: "500 14.5px 'Archivo',sans-serif", color: p.ink },
  dropdown: {
    position: 'absolute',
    top: '54px',
    left: 0,
    right: 0,
    zIndex: 60,
    background: p.panel,
    border: '1px solid ' + p.line,
    borderRadius: '18px',
    boxShadow: '0 26px 60px -20px rgba(20,10,20,.4)',
    padding: '10px',
    animation: 'hsFade .16s ease',
  },
  label: { font: "700 10.5px 'Archivo',sans-serif", letterSpacing: '1.4px', textTransform: 'uppercase', color: ACCENT, padding: '8px 12px 6px' },
  label2: {
    font: "700 10.5px 'Archivo',sans-serif",
    letterSpacing: '1.4px',
    textTransform: 'uppercase',
    color: p.faint,
    padding: '10px 12px 6px',
    borderTop: '1px solid ' + p.line,
    marginTop: '4px',
  },
  row: { display: 'flex', alignItems: 'center', gap: '11px', padding: '10px 12px', borderRadius: '11px', cursor: 'pointer', transition: 'background .12s' },
  trendUp: {
    width: '22px',
    height: '22px',
    flex: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '7px',
    background: 'rgba(255,45,111,.12)',
    color: ACCENT,
    fontSize: '13px',
    fontWeight: 700,
  },
  recentIcon: { width: '22px', height: '22px', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: p.faint, fontSize: '15px' },
  rowText: { flex: 1, font: "500 14px 'Archivo',sans-serif", color: p.ink },
  rowTag: { font: "600 10.5px 'Archivo',sans-serif", letterSpacing: '.3px', color: p.faint, textTransform: 'capitalize' },
  backdrop: { position: 'fixed', inset: 0, zIndex: 40 },
};

export interface TrendingItem {
  text: string;
  tag: string;
}

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: (term: string) => void;
  trending: TrendingItem[];
  recent: string[];
}

export default function SearchBar({ value, onChange, onSearch, trending, recent }: SearchBarProps) {
  const [focused, setFocused] = useState(false);

  const pick = (term: string) => {
    setFocused(false);
    onSearch(term);
  };

  return (
    <>
      <div style={S.wrap}>
        <div style={S.pill}>
          <span style={S.icon}>⌕</span>
          <input
            value={value}
            onFocus={() => setFocused(true)}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && value.trim()) pick(value.trim());
              if (e.key === 'Escape') setFocused(false);
            }}
            placeholder="Search London — food, views, nightlife…"
            style={S.input}
          />
        </div>
        {focused && (
          <div style={S.dropdown}>
            <div style={S.label}>Trending in London</div>
            {trending.map((t) => (
              <div key={t.text} className="hs-row" onClick={() => pick(t.text)} style={S.row}>
                <span style={S.trendUp}>↗</span>
                <span style={S.rowText}>{t.text}</span>
                <span style={S.rowTag}>{t.tag}</span>
              </div>
            ))}
            {recent.length > 0 && (
              <>
                <div style={S.label2}>Recent</div>
                {recent.map((r) => (
                  <div key={r} className="hs-row" onClick={() => pick(r)} style={S.row}>
                    <span style={S.recentIcon}>↺</span>
                    <span style={S.rowText}>{r}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
      {focused && <div onMouseDown={() => setFocused(false)} style={S.backdrop} />}
    </>
  );
}
