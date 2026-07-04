import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { fetchAllVideos, searchVideos, searchWords } from './lib/videos';
import { pal } from './palette';
import SearchBar, { type TrendingItem } from './SearchBar';
import type { Category, Video } from './types';
import VideoCard, { ACCENT } from './VideoCard';

const p = pal('Paper');

type Style = CSSProperties & Record<string, unknown>;
type Screen = 'feed' | 'results';

// Static until a trending_searches table exists — terms curated to hit the seeded rows.
const TRENDING: TrendingItem[] = [
  { text: 'rooftop bars shoreditch', tag: 'nightlife' },
  { text: 'borough market eats', tag: 'food' },
  { text: 'greenwich golden hour', tag: 'views' },
  { text: 'soho after dark', tag: 'nightlife' },
  { text: 'hidden east london', tag: 'thingstodo' },
];

const FILTERS: { label: string; cat: Category | null }[] = [
  { label: 'All', cat: null },
  { label: 'Food', cat: 'food' },
  { label: 'Views', cat: 'views' },
  { label: 'Nightlife', cat: 'nightlife' },
  { label: 'Things to do', cat: 'thingstodo' },
  { label: 'Culture', cat: 'culture' },
];

const RECENT_KEY = 'hotspot.recentSearches';

function loadRecent(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((r) => typeof r === 'string').slice(0, 4) : [];
  } catch {
    return [];
  }
}

// Turns '#LondonRooftops' into 'london rooftops' so a chip click reads as a search.
function tagToTerm(tag: string): string {
  return tag
    .replace(/^#/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase();
}

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
  logoDot: { color: ACCENT },
  page: { maxWidth: '1560px', margin: '0 auto', padding: '26px clamp(16px,3vw,34px) 80px' },
  masthead: { display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '14px', margin: '6px 0 22px' },
  resultsHead: { margin: '6px 0 18px' },
  eyebrow: { font: "700 11px 'Archivo',sans-serif", letterSpacing: '1.6px', textTransform: 'uppercase', color: ACCENT, marginBottom: '4px' },
  h1: { font: "600 clamp(30px,4vw,46px)/1.02 'Oswald',sans-serif", letterSpacing: '.3px', color: p.ink, margin: 0 },
  mastheadSub: { maxWidth: '380px', font: "400 13.5px/1.5 'Archivo',sans-serif", color: p.mut },
  hashRow: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' },
  hashChip: {
    font: "600 12px 'Archivo',sans-serif",
    color: ACCENT,
    padding: '5px 11px',
    borderRadius: '999px',
    background: 'rgba(255,45,111,.09)',
    border: '1px solid rgba(255,45,111,.2)',
    cursor: 'pointer',
  },
  chipsRow: { display: 'flex', flexWrap: 'wrap', gap: '9px', margin: '0 0 22px' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '26px 18px',
    alignItems: 'start',
  },
  skThumb: {
    borderRadius: '18px',
    aspectRatio: '9 / 16',
    background: 'rgba(26,21,18,.07)',
    backgroundImage: 'linear-gradient(100deg, transparent 20%, rgba(255,255,255,.55) 50%, transparent 80%)',
    backgroundSize: '220% 100%',
    animation: 'hsShimmer 1.25s ease-in-out infinite',
  },
  skBar: {
    height: '12px',
    width: '82%',
    borderRadius: '6px',
    marginTop: '11px',
    background: p.chip,
    backgroundImage: 'linear-gradient(100deg, transparent 20%, rgba(255,255,255,.55) 50%, transparent 80%)',
    backgroundSize: '220% 100%',
    animation: 'hsShimmer 1.25s ease-in-out infinite',
  },
  stateWrap: { textAlign: 'center', padding: '70px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' },
  stateTitle: { font: "600 24px 'Oswald',sans-serif", color: p.ink },
  stateText: { font: "400 14px 'Archivo',sans-serif", color: p.mut, maxWidth: '360px' },
  stateBtn: { marginTop: '14px', padding: '12px 22px', borderRadius: '999px', border: 'none', cursor: 'pointer', background: ACCENT, color: '#fff', font: "600 13.5px 'Archivo',sans-serif" },
};

export default function Feed() {
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>('feed');
  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [results, setResults] = useState<Video[] | null>(null);
  const [resultsError, setResultsError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Category | null>(null);
  const [recent, setRecent] = useState<string[]>(loadRecent);
  const [hearted, setHearted] = useState<Record<string, boolean>>({});
  const searchSeq = useRef(0);

  const loadFeed = useCallback(() => {
    setVideos(null);
    setFeedError(null);
    fetchAllVideos()
      .then(setVideos)
      .catch((e: Error) => setFeedError(e.message));
  }, []);

  useEffect(loadFeed, [loadFeed]);

  const doSearch = useCallback((term: string) => {
    const seq = ++searchSeq.current;
    setQuery(term);
    setActiveQuery(term);
    setScreen('results');
    setFilter(null);
    setResults(null);
    setResultsError(null);
    setRecent((r) => {
      const next = [term, ...r.filter((x) => x !== term)].slice(0, 4);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      return next;
    });
    window.scrollTo({ top: 0 });
    searchVideos(term)
      .then((rows) => {
        if (searchSeq.current === seq) setResults(rows);
      })
      .catch((e: Error) => {
        if (searchSeq.current === seq) setResultsError(e.message);
      });
  }, []);

  const goFeed = useCallback(() => {
    searchSeq.current++;
    setScreen('feed');
    setQuery('');
    setFilter(null);
    window.scrollTo({ top: 0 });
  }, []);

  const toggleHeart = useCallback((id: string) => {
    setHearted((h) => ({ ...h, [id]: !h[id] }));
  }, []);

  const isResults = screen === 'results';
  const source = isResults ? results : videos;
  const error = isResults ? resultsError : feedError;
  const loading = source === null && !error;
  const shown = source?.filter((v) => !filter || v.category === filter) ?? [];

  // Chips under the results heading: most frequent hashtags in the results,
  // padded with slugs from the query itself.
  const hashtags = useMemo(() => {
    if (!isResults) return [];
    const counts = new Map<string, { tag: string; n: number }>();
    for (const v of results ?? []) {
      for (const t of v.hashtags ?? []) {
        const k = t.toLowerCase();
        const e = counts.get(k);
        if (e) e.n++;
        else counts.set(k, { tag: t, n: 1 });
      }
    }
    const top = [...counts.values()].sort((a, b) => b.n - a.n).map((e) => e.tag);
    const padding = searchWords(activeQuery).map((w) => '#' + w);
    return [...new Set([...top, ...padding])].slice(0, 6);
  }, [isResults, results, activeQuery]);

  const emptyResults = isResults && results !== null && shown.length === 0;
  const emptyFeed = !isResults && videos !== null && shown.length === 0;

  return (
    <div style={S.root}>
      <nav style={S.nav}>
        <div style={S.logo} onClick={goFeed}>
          HOT<span style={S.logoDot}>SPOT</span>
        </div>
        <SearchBar value={query} onChange={setQuery} onSearch={doSearch} trending={TRENDING} recent={recent} />
      </nav>

      <main style={S.page}>
        {!isResults && (
          <div style={S.masthead}>
            <div>
              <div style={S.eyebrow}>Live from the city</div>
              <h1 style={S.h1}>Trending in London</h1>
            </div>
            <div style={S.mastheadSub}>
              A curated mix of reels worth the trip — golden-hour views, hidden eats, and after-dark energy.
            </div>
          </div>
        )}

        {isResults && (
          <div style={S.resultsHead}>
            <div style={S.eyebrow}>Results for</div>
            <h1 style={S.h1}>{activeQuery}</h1>
            <div style={S.hashRow}>
              {hashtags.map((h) => (
                <button key={h} className="hs-chip" style={S.hashChip} onClick={() => doSearch(tagToTerm(h))}>
                  {h}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={S.chipsRow}>
          {FILTERS.map(({ label, cat }) => {
            const active = filter === cat;
            return (
              <button
                key={label}
                className="hs-chip"
                onClick={() => setFilter(cat)}
                style={{
                  padding: '9px 16px',
                  borderRadius: '999px',
                  cursor: 'pointer',
                  font: "600 12.5px 'Archivo',sans-serif",
                  letterSpacing: '.2px',
                  border: '1px solid ' + (active ? ACCENT : p.line),
                  background: active ? ACCENT : p.panel,
                  color: active ? '#fff' : p.chipInk,
                  transition: 'all .16s',
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {error && (
          <div style={S.stateWrap}>
            <div style={S.stateTitle}>Couldn’t load {isResults ? 'results' : 'the feed'}</div>
            <div style={S.stateText}>{error}</div>
            <button style={S.stateBtn} onClick={isResults ? () => doSearch(activeQuery) : loadFeed}>
              Try again
            </button>
          </div>
        )}

        {emptyResults && (
          <div style={S.stateWrap}>
            <div style={S.stateTitle}>No matches for “{activeQuery}”</div>
            <div style={S.stateText}>
              {filter ? 'Nothing in this category — try “All”, or ' : 'Try a broader term, or '}
              browse what’s trending in London right now.
            </div>
            <button style={S.stateBtn} onClick={goFeed}>
              Back to the feed
            </button>
          </div>
        )}

        {emptyFeed && (
          <div style={S.stateWrap}>
            <div style={S.stateTitle}>Nothing here yet</div>
            <div style={S.stateText}>
              {filter ? 'No videos in this category yet — try “All”.' : 'The videos table is empty — run the ingest script to seed it.'}
            </div>
          </div>
        )}

        <div style={S.grid}>
          {loading &&
            Array.from({ length: 10 }, (_, i) => (
              <div key={i}>
                <div style={S.skThumb} />
                <div style={S.skBar} />
              </div>
            ))}
          {shown.map((v) => (
            <VideoCard key={v.id} video={v} hearted={!!hearted[v.id]} onToggleHeart={toggleHeart} />
          ))}
        </div>
      </main>
    </div>
  );
}
