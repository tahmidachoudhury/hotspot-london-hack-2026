import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  ASPECTS,
  PLATFORMS,
  RECENT,
  TONES,
  TRENDING,
  URLS,
  buildFeed,
  catFilter,
  fmt,
  matches,
  slug,
  type Category,
  type FeedItem,
} from './data';
import { pal, type Theme } from './palette';

type Density = 'Cozy' | 'Dense';
type Screen = 'feed' | 'results' | 'saved';
type Style = CSSProperties & Record<string, unknown>;

export interface HotspotFeedProps {
  accent?: string;
  theme?: Theme;
  density?: Density;
  showBadges?: boolean;
}

interface CardView extends FeedItem {
  platformLabel: string;
  viewsLabel: string;
  meta: string;
  heartGlyph: string;
  thumbStyle: Style;
  mediaStyle: Style;
  badgeStyle: Style;
  heartStyle: Style;
  titleStyle: Style;
  metaStyle: Style;
  onOpen: () => void;
  onToggleSave: (e: React.MouseEvent) => void;
}

const FILTER_NAMES = ['All', 'Food', 'Views', 'Nightlife', 'Activities'];

function columns(width: number, density: Density): number {
  let c = width < 560 ? 2 : width < 900 ? 3 : width < 1250 ? 4 : width < 1650 ? 5 : 6;
  if (density === 'Dense') c += 1;
  return Math.min(c, 7);
}

export default function HotspotFeed({
  accent = '#ff2d6f',
  theme = 'Paper',
  density = 'Cozy',
  showBadges = true,
}: HotspotFeedProps) {
  const feed = useMemo(() => buildFeed(), []);

  const [screen, setScreen] = useState<Screen>('feed');
  const [searchFocused, setSearchFocused] = useState(false);
  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [saved, setSaved] = useState<Record<string, boolean>>({ '2-0': true, '11-0': true, '5-1': true });
  const [feedCount, setFeedCount] = useState(26);
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1400);
  const [loading, setLoading] = useState(true);

  const screenRef = useRef(screen);
  const searchFocusedRef = useRef(searchFocused);
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  screenRef.current = screen;
  searchFocusedRef.current = searchFocused;

  // Simulates a fetch delay so the skeleton grid has somewhere to live once a real DB call replaces buildFeed().
  const scheduleLoad = useCallback((ms: number) => {
    clearTimeout(loadTimeoutRef.current);
    setLoading(true);
    loadTimeoutRef.current = setTimeout(() => setLoading(false), ms);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      if (screenRef.current !== 'feed' || searchFocusedRef.current) return;
      const el = document.scrollingElement || document.documentElement;
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 700) {
        setFeedCount((c) => (c >= feed.length ? c : Math.min(c + 10, feed.length)));
      }
    };
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    loadTimeoutRef.current = setTimeout(() => setLoading(false), 950);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      clearTimeout(loadTimeoutRef.current);
    };
  }, [feed.length]);

  const toggleSave = useCallback((uid: string) => {
    setSaved((s) => {
      const n = { ...s };
      if (n[uid]) delete n[uid];
      else n[uid] = true;
      return n;
    });
  }, []);

  const goFeed = useCallback(() => {
    scheduleLoad(700);
    setScreen('feed');
    setSearchFocused(false);
    window.scrollTo({ top: 0 });
  }, [scheduleLoad]);

  const goSaved = useCallback(() => {
    scheduleLoad(650);
    setScreen('saved');
    setSearchFocused(false);
    window.scrollTo({ top: 0 });
  }, [scheduleLoad]);

  const submit = useCallback(() => {
    const q = query.trim();
    if (!q) return;
    scheduleLoad(850);
    setActiveQuery(q);
    setScreen('results');
    setSearchFocused(false);
    setFilter('All');
    window.scrollTo({ top: 0 });
  }, [query, scheduleLoad]);

  const pick = useCallback((t: string) => {
    scheduleLoad(850);
    setQuery(t);
    setActiveQuery(t);
    setScreen('results');
    setSearchFocused(false);
    setFilter('All');
    window.scrollTo({ top: 0 });
  }, [scheduleLoad]);

  const p = pal(theme);
  const isFeed = screen === 'feed';
  const isResults = screen === 'results';
  const isSaved = screen === 'saved';

  let base: FeedItem[];
  if (isFeed) {
    base = feed.slice(0, feedCount);
  } else if (isResults) {
    const cats = catFilter(filter);
    let b = feed.filter((it) => (!cats || cats.includes(it.category)) && matches(it, activeQuery));
    if (b.length < 6) b = feed.filter((it) => !cats || cats.includes(it.category)).slice(0, 18);
    base = b.slice(0, 24);
  } else {
    base = feed.filter((it) => saved[it.uid]);
  }

  const cards: CardView[] = loading ? [] : base.map((it) => {
    const [c0, c1] = TONES[it.category];
    const isSavedItem = !!saved[it.uid];
    const plat = PLATFORMS[it.platform];
    return {
      ...it,
      platformLabel: `${plat.glyph}  ${plat.label}`,
      viewsLabel: fmt(Math.round(it.likes * (7 + (parseInt(it.id, 10) % 9)))),
      meta: `${it.handle}  ·  ${it.place}  ·  ♥ ${fmt(it.likes)}`,
      heartGlyph: isSavedItem ? '♥' : '♡',
      thumbStyle: {
        position: 'relative',
        borderRadius: '18px',
        overflow: 'hidden',
        aspectRatio: it.aspect,
        background: '#0c0a10',
        boxShadow: '0 6px 18px -10px rgba(20,10,20,.4)',
        transition: 'box-shadow .24s',
      },
      mediaStyle: {
        position: 'absolute',
        inset: 0,
        transformOrigin: 'center',
        transition: 'transform .55s cubic-bezier(.2,.7,.3,1)',
        background: `radial-gradient(120% 85% at 28% 8%, rgba(255,255,255,.22), transparent 55%), linear-gradient(158deg, ${c0} 0%, ${c1} 100%)`,
      },
      badgeStyle: {
        position: 'absolute',
        top: '10px',
        left: '10px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '2px',
        padding: '5px 9px',
        borderRadius: '999px',
        font: "600 10.5px 'Archivo',sans-serif",
        letterSpacing: '.2px',
        color: '#fff',
        background: 'rgba(14,10,16,.42)',
        backdropFilter: 'blur(7px)',
        WebkitBackdropFilter: 'blur(7px)',
        border: '1px solid rgba(255,255,255,.14)',
      },
      heartStyle: {
        position: 'absolute',
        top: '9px',
        right: '9px',
        width: '34px',
        height: '34px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        cursor: 'pointer',
        fontSize: '16px',
        lineHeight: 1,
        padding: 0,
        transition: 'transform .18s, background .18s, color .18s',
        background: isSavedItem ? 'rgba(255,255,255,.95)' : 'rgba(14,10,16,.42)',
        color: isSavedItem ? accent : '#fff',
        backdropFilter: 'blur(7px)',
        WebkitBackdropFilter: 'blur(7px)',
        opacity: isSavedItem ? 1 : 0,
        animation: isSavedItem ? 'hsPop .4s ease' : 'none',
      },
      titleStyle: {
        font: "600 15px/1.22 'Oswald',sans-serif",
        letterSpacing: '.2px',
        color: p.ink,
        marginTop: '9px',
        overflow: 'hidden',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
      },
      metaStyle: {
        font: "500 11.5px/1.3 'Archivo',sans-serif",
        color: p.mut,
        marginTop: '3px',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      },
      onOpen: () => window.open(URLS[it.platform] || 'https://www.tiktok.com', '_blank', 'noopener'),
      onToggleSave: (e: React.MouseEvent) => {
        e.stopPropagation();
        toggleSave(it.uid);
      },
    };
  });

  const filterChips = FILTER_NAMES.map((name) => {
    const active = filter === name;
    return {
      name,
      onClick: () => setFilter(name),
      style: {
        padding: '9px 16px',
        borderRadius: '999px',
        cursor: 'pointer',
        font: "600 12.5px 'Archivo',sans-serif",
        letterSpacing: '.2px',
        border: '1px solid ' + (active ? accent : p.line),
        background: active ? accent : p.panel,
        color: active ? '#fff' : p.chipInk,
        transition: 'all .16s',
        whiteSpace: 'nowrap',
      } as Style,
    };
  });

  const words = activeQuery.split(/\s+/).filter((w) => w.length > 2).slice(0, 3);
  const hashtags = [...new Set(words.map((w) => slug(w)).concat(['#londonreels', '#hiddenlondon']))].slice(0, 6);

  const savedCount = Object.keys(saved).length;
  const hasSaved = savedCount > 0;
  const showChips = isFeed || isResults;
  const showEmpty = isSaved && !loading && cards.length === 0;
  const showLoading = isFeed && !loading && feedCount < feed.length;
  const savedSubtitle = savedCount > 0 ? `${savedCount} reel${savedCount === 1 ? '' : 's'} saved for later` : 'Nothing saved yet';

  const cols = columns(width, density);

  const skShimmerColor = theme === 'Midnight' ? 'rgba(255,255,255,.09)' : 'rgba(255,255,255,.6)';
  const skBase: Style = {
    position: 'relative',
    borderRadius: '18px',
    overflow: 'hidden',
    background: theme === 'Midnight' ? 'rgba(255,255,255,.07)' : 'rgba(26,21,18,.07)',
    backgroundImage: `linear-gradient(100deg, transparent 20%, ${theme === 'Midnight' ? 'rgba(255,255,255,.09)' : 'rgba(255,255,255,.55)'} 50%, transparent 80%)`,
    backgroundSize: '220% 100%',
    animation: 'hsShimmer 1.25s ease-in-out infinite',
  };
  const skels = ASPECTS.concat(ASPECTS).slice(0, Math.max(cols * 2, 10));
  const skeletons = skels.map((aspect) => ({ thumbStyle: { ...skBase, aspectRatio: aspect } as Style }));

  const S: Record<string, Style> = {
    root: { minHeight: '100vh', background: p.bg, color: p.ink, fontFamily: "'Archivo',system-ui,sans-serif" },
    nav: {
      position: 'sticky',
      top: 0,
      zIndex: 50,
      display: 'flex',
      alignItems: 'center',
      gap: '20px',
      padding: '13px clamp(16px,3vw,34px)',
      background: p.navBg,
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderBottom: '1px solid ' + p.line,
    },
    logo: { cursor: 'pointer', flex: 'none', font: "700 22px 'Oswald',sans-serif", letterSpacing: '1.5px', color: p.ink, userSelect: 'none' },
    logoDot: { color: accent },
    searchWrap: { position: 'relative', flex: '1 1 auto', maxWidth: '560px', margin: '0 auto' },
    searchPill: {
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
    searchIcon: { fontSize: '19px', color: p.faint, lineHeight: 1 },
    searchInput: { flex: 1, border: 'none', outline: 'none', background: 'transparent', font: "500 14.5px 'Archivo',sans-serif", color: p.ink },
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
    dropLabel: { font: "700 10.5px 'Archivo',sans-serif", letterSpacing: '1.4px', textTransform: 'uppercase', color: accent, padding: '8px 12px 6px' },
    dropLabel2: {
      font: "700 10.5px 'Archivo',sans-serif",
      letterSpacing: '1.4px',
      textTransform: 'uppercase',
      color: p.faint,
      padding: '10px 12px 6px',
      borderTop: '1px solid ' + p.line,
      marginTop: '4px',
    },
    dropRow: { display: 'flex', alignItems: 'center', gap: '11px', padding: '10px 12px', borderRadius: '11px', cursor: 'pointer', transition: 'background .12s' },
    trendUp: {
      width: '22px',
      height: '22px',
      flex: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '7px',
      background: 'rgba(255,45,111,.12)',
      color: accent,
      fontSize: '13px',
      fontWeight: 700,
    },
    recentIcon: { width: '22px', height: '22px', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: p.faint, fontSize: '15px' },
    rowText: { flex: 1, font: "500 14px 'Archivo',sans-serif", color: p.ink },
    rowTag: { font: "600 10.5px 'Archivo',sans-serif", letterSpacing: '.3px', color: p.faint, textTransform: 'capitalize' },
    navRight: { flex: 'none', display: 'flex', alignItems: 'center', gap: '12px' },
    savedBtn: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '7px',
      height: '40px',
      padding: '0 15px',
      borderRadius: '999px',
      cursor: 'pointer',
      border: '1px solid ' + p.line,
      background: p.panel,
      color: p.ink,
      font: "600 13px 'Archivo',sans-serif",
    },
    savedHeart: { color: accent, fontSize: '14px' },
    savedCount: {
      minWidth: '19px',
      height: '19px',
      padding: '0 5px',
      borderRadius: '999px',
      background: accent,
      color: '#fff',
      font: "700 11px 'Archivo',sans-serif",
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatar: {
      width: '40px',
      height: '40px',
      borderRadius: '50%',
      flex: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      font: "700 13px 'Oswald',sans-serif",
      letterSpacing: '.5px',
      color: '#fff',
      background: `linear-gradient(150deg,${accent}, #7b4be0)`,
    },
    backdrop: { position: 'fixed', inset: 0, zIndex: 40 },
    page: { maxWidth: '1560px', margin: '0 auto', padding: '26px clamp(16px,3vw,34px) 80px' },
    masthead: { display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '14px', margin: '6px 0 22px' },
    resultsHead: { margin: '6px 0 18px' },
    eyebrow: { font: "700 11px 'Archivo',sans-serif", letterSpacing: '1.6px', textTransform: 'uppercase', color: accent, marginBottom: '4px' },
    h1: { font: "600 clamp(30px,4vw,46px)/1.02 'Oswald',sans-serif", letterSpacing: '.3px', color: p.ink, margin: 0 },
    mastheadSub: { maxWidth: '380px', font: "400 13.5px/1.5 'Archivo',sans-serif", color: p.mut },
    hashRow: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' },
    hashChip: { font: "600 12px 'Archivo',sans-serif", color: accent, padding: '5px 11px', borderRadius: '999px', background: 'rgba(255,45,111,.09)', border: '1px solid rgba(255,45,111,.2)' },
    chipsRow: { display: 'flex', flexWrap: 'wrap', gap: '9px', margin: '0 0 22px' },
    grid: { columnCount: cols, columnGap: '18px' },
    card: { display: 'inline-block', width: '100%', breakInside: 'avoid', WebkitColumnBreakInside: 'avoid', marginBottom: '22px', cursor: 'pointer' },
    skCard: { display: 'inline-block', width: '100%', breakInside: 'avoid', WebkitColumnBreakInside: 'avoid', marginBottom: '22px' },
    skBar1: {
      height: '12px',
      width: '82%',
      borderRadius: '6px',
      marginTop: '11px',
      background: p.chip,
      backgroundImage: `linear-gradient(100deg, transparent 20%, ${skShimmerColor} 50%, transparent 80%)`,
      backgroundSize: '220% 100%',
      animation: 'hsShimmer 1.25s ease-in-out infinite',
    },
    skBar2: {
      height: '10px',
      width: '55%',
      borderRadius: '6px',
      marginTop: '7px',
      background: p.chip,
      backgroundImage: `linear-gradient(100deg, transparent 20%, ${skShimmerColor} 50%, transparent 80%)`,
      backgroundSize: '220% 100%',
      animation: 'hsShimmer 1.25s ease-in-out infinite',
    },
    caption: { padding: '0 2px' },
    play: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%,-50%)',
      width: '50px',
      height: '50px',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(255,255,255,.16)',
      border: '1px solid rgba(255,255,255,.35)',
      backdropFilter: 'blur(3px)',
      WebkitBackdropFilter: 'blur(3px)',
      color: '#fff',
      fontSize: '15px',
      paddingLeft: '3px',
      opacity: 0.82,
      transition: 'transform .22s, opacity .22s',
      pointerEvents: 'none',
    },
    dropHint: {
      position: 'absolute',
      bottom: '10px',
      left: '11px',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      padding: '4px 9px 4px 8px',
      borderRadius: '999px',
      font: "600 11.5px 'Archivo',sans-serif",
      letterSpacing: '.2px',
      color: '#fff',
      background: 'rgba(14,10,16,.42)',
      backdropFilter: 'blur(7px)',
      WebkitBackdropFilter: 'blur(7px)',
      border: '1px solid rgba(255,255,255,.14)',
      pointerEvents: 'none',
    },
    sentinel: { textAlign: 'center', padding: '26px', font: "500 13px 'Archivo',sans-serif", color: p.mut, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px' },
    sentinelDot: { width: '8px', height: '8px', borderRadius: '50%', background: accent, animation: 'hsPop 1s ease infinite' },
    emptyWrap: { textAlign: 'center', padding: '70px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' },
    emptyHeart: { fontSize: '52px', color: p.faint, lineHeight: 1 },
    emptyTitle: { font: "600 24px 'Oswald',sans-serif", color: p.ink, marginTop: '6px' },
    emptyText: { font: "400 14px 'Archivo',sans-serif", color: p.mut, maxWidth: '320px' },
    emptyBtn: { marginTop: '14px', padding: '12px 22px', borderRadius: '999px', border: 'none', cursor: 'pointer', background: accent, color: '#fff', font: "600 13.5px 'Archivo',sans-serif" },
  };

  const trending = TRENDING.map((t) => ({ text: t.text, tag: t.tag as Category, onPick: () => pick(t.text) }));
  const recent = RECENT.map((t) => ({ text: t, onPick: () => pick(t) }));

  return (
    <div style={S.root}>
      <nav style={S.nav}>
        <div onClick={goFeed} style={S.logo}>
          <span>
            HOT<span style={S.logoDot}>SPOT</span>
          </span>
        </div>

        <div style={S.searchWrap}>
          <div style={S.searchPill}>
            <span style={S.searchIcon}>⌕</span>
            <input
              value={query}
              onFocus={() => setSearchFocused(true)}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
                if (e.key === 'Escape') setSearchFocused(false);
              }}
              placeholder="Search London — food, views, nightlife…"
              style={S.searchInput}
            />
          </div>
          {searchFocused && (
            <div style={S.dropdown}>
              <div style={S.dropLabel}>Trending in London</div>
              {trending.map((t) => (
                <div key={t.text} className="hs-row" onClick={t.onPick} style={S.dropRow}>
                  <span style={S.trendUp}>↗</span>
                  <span style={S.rowText}>{t.text}</span>
                  <span style={S.rowTag}>{t.tag}</span>
                </div>
              ))}
              <div style={S.dropLabel2}>Recent</div>
              {recent.map((r) => (
                <div key={r.text} className="hs-row" onClick={r.onPick} style={S.dropRow}>
                  <span style={S.recentIcon}>↺</span>
                  <span style={S.rowText}>{r.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={S.navRight}>
          <button onClick={goSaved} style={S.savedBtn}>
            <span style={S.savedHeart}>♥</span>
            <span>Saved</span>
            {hasSaved && <span style={S.savedCount}>{savedCount}</span>}
          </button>
          <div style={S.avatar}>LN</div>
        </div>
      </nav>

      {searchFocused && <div onMouseDown={() => setSearchFocused(false)} style={S.backdrop} />}

      <main style={S.page}>
        {isFeed && (
          <div style={S.masthead}>
            <div>
              <div style={S.eyebrow}>For you · live from the city</div>
              <h1 style={S.h1}>Trending in London</h1>
            </div>
            <div style={S.mastheadSub}>A curated mix of reels worth the trip — golden-hour views, hidden eats, and after-dark energy.</div>
          </div>
        )}

        {isResults && (
          <div style={S.resultsHead}>
            <div style={S.eyebrow}>Results for</div>
            <h1 style={S.h1}>{activeQuery}</h1>
            <div style={S.hashRow}>
              {hashtags.map((h) => (
                <span key={h} style={S.hashChip}>
                  {h}
                </span>
              ))}
            </div>
          </div>
        )}

        {isSaved && (
          <div style={S.resultsHead}>
            <div style={S.eyebrow}>Your collection</div>
            <h1 style={S.h1}>Saved spots</h1>
            <div style={S.mastheadSub}>{savedSubtitle}</div>
          </div>
        )}

        {showChips && (
          <div style={S.chipsRow}>
            {filterChips.map((c) => (
              <button key={c.name} className="hs-chip" onClick={c.onClick} style={c.style}>
                {c.name}
              </button>
            ))}
          </div>
        )}

        {showEmpty && (
          <div style={S.emptyWrap}>
            <div style={S.emptyHeart}>♡</div>
            <div style={S.emptyTitle}>Nothing saved yet</div>
            <div style={S.emptyText}>Tap the heart on any reel to keep it here for later.</div>
            <button onClick={goFeed} style={S.emptyBtn}>
              Browse the feed
            </button>
          </div>
        )}

        <div style={S.grid}>
          {loading &&
            skeletons.map((sk, i) => (
              <div key={i} style={S.skCard}>
                <div style={sk.thumbStyle} />
                <div style={S.skBar1} />
                <div style={S.skBar2} />
              </div>
            ))}
          {cards.map((item) => (
            <div key={item.uid} className="hsc" onClick={item.onOpen} style={S.card}>
              <div className="hsc-thumb" style={item.thumbStyle}>
                <div className="hsc-media" style={item.mediaStyle} />
                {showBadges && <span style={item.badgeStyle}>{item.platformLabel}</span>}
                <button className="hsc-heart" onClick={item.onToggleSave} style={item.heartStyle}>
                  {item.heartGlyph}
                </button>
                <span className="hsc-play" style={S.play}>
                  ▶
                </span>
                <span style={S.dropHint}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  {item.viewsLabel}
                </span>
              </div>
              <div style={S.caption}>
                <div style={item.titleStyle}>{item.title}</div>
                <div style={item.metaStyle}>{item.meta}</div>
              </div>
            </div>
          ))}
        </div>

        {showLoading && (
          <div style={S.sentinel}>
            <span style={S.sentinelDot} /> Loading more London…
          </div>
        )}
      </main>
    </div>
  );
}
