import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import AuthModal from './AuthModal';
import { signOut, useAuth } from './lib/auth';
import { addSave, fetchSavedIds, removeSave } from './lib/saves';
import { fetchAllVideos, searchVideos, searchWords } from './lib/videos';
import MapView from './MapView';
import { pal } from './palette';
import SearchBar, { type TrendingItem } from './SearchBar';
import type { Category, Video } from './types';
import VideoCard, { ACCENT } from './VideoCard';

const p = pal('Paper');

type Style = CSSProperties & Record<string, unknown>;
type Screen = 'feed' | 'results' | 'saved' | 'map';

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

// Masonry: same responsive column count as the old auto-fill grid, but real
// column divs so each column can be nudged down a little — breaks the flat
// row alignment without touching card markup or order (round-robin keeps
// left-to-right reading order).
const COL_MIN = 200;
const GAP_X = 18;
const GAP_Y = 26;
const STAGGER = [0, 30, 12, 40]; // px offset per column, repeating

function MasonryGrid({ items }: { items: ReactNode[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(4);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setCols(Math.max(1, Math.floor((el.clientWidth + GAP_X) / (COL_MIN + GAP_X))));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const buckets: ReactNode[][] = Array.from({ length: cols }, () => []);
  items.forEach((item, i) => buckets[i % cols].push(item));

  return (
    <div ref={ref} style={{ display: 'flex', gap: `${GAP_X}px`, alignItems: 'flex-start' }}>
      {buckets.map((bucket, ci) => (
        <div
          key={ci}
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: `${GAP_Y}px`,
            marginTop: `${STAGGER[ci % STAGGER.length]}px`,
          }}
        >
          {bucket}
        </div>
      ))}
    </div>
  );
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
  savedHeart: { color: ACCENT, fontSize: '14px' },
  mapBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '7px',
    height: '40px',
    padding: '0 16px',
    borderRadius: '999px',
    cursor: 'pointer',
    border: 'none',
    background: `linear-gradient(150deg,${ACCENT}, #7b4be0)`,
    color: '#fff',
    font: "600 13px 'Archivo',sans-serif",
    letterSpacing: '.2px',
  },
  savedCount: {
    minWidth: '19px',
    height: '19px',
    padding: '0 5px',
    borderRadius: '999px',
    background: ACCENT,
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
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    font: "700 13px 'Oswald',sans-serif",
    letterSpacing: '.5px',
    color: '#fff',
    background: `linear-gradient(150deg,${ACCENT}, #7b4be0)`,
  },
  menu: {
    position: 'absolute',
    top: '48px',
    right: 0,
    zIndex: 60,
    minWidth: '210px',
    background: p.panel,
    border: '1px solid ' + p.line,
    borderRadius: '14px',
    boxShadow: '0 26px 60px -20px rgba(20,10,20,.4)',
    padding: '8px',
    animation: 'hsFade .16s ease',
  },
  menuEmail: { font: "500 12.5px 'Archivo',sans-serif", color: p.mut, padding: '8px 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  menuOut: { width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: '9px', border: 'none', cursor: 'pointer', background: 'none', color: p.ink, font: "600 13px 'Archivo',sans-serif" },
  menuBackdrop: { position: 'fixed', inset: 0, zIndex: 40 },
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
  h2: { font: "600 24px 'Oswald',sans-serif", letterSpacing: '.2px', color: p.ink, margin: '2px 0 16px' },
  mapHint: { font: "400 14px 'Archivo',sans-serif", color: p.mut, textAlign: 'center', padding: '22px' },
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
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [authOpen, setAuthOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mapPick, setMapPick] = useState<Video[] | null>(null);
  const { user } = useAuth();
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

  const goSaved = useCallback(() => {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    searchSeq.current++;
    setScreen('saved');
    setFilter(null);
    window.scrollTo({ top: 0 });
  }, [user]);

  const goMap = useCallback(() => {
    searchSeq.current++;
    setScreen('map');
    setFilter(null);
    setMapPick(null);
    window.scrollTo({ top: 0 });
  }, []);

  // Load this user's saves whenever the session changes; clear them on sign-out.
  useEffect(() => {
    if (!user) {
      setSaved({});
      return;
    }
    fetchSavedIds()
      .then((ids) => setSaved(Object.fromEntries([...ids].map((id) => [id, true]))))
      .catch((e: Error) => console.warn('could not load saves:', e.message));
  }, [user]);

  const toggleHeart = useCallback(
    (id: string) => {
      if (!user) {
        setAuthOpen(true);
        return;
      }
      const on = !saved[id];
      setSaved((s) => {
        const n = { ...s };
        if (on) n[id] = true;
        else delete n[id];
        return n;
      });
      // Optimistic — revert the heart if the write fails.
      (on ? addSave(user.id, id) : removeSave(id)).catch((e: Error) => {
        console.warn('save failed:', e.message);
        setSaved((s) => {
          const n = { ...s };
          if (on) delete n[id];
          else n[id] = true;
          return n;
        });
      });
    },
    [user, saved],
  );

  const doSignOut = useCallback(() => {
    setMenuOpen(false);
    setScreen((s) => (s === 'saved' ? 'feed' : s));
    signOut();
  }, []);

  const isResults = screen === 'results';
  const isSaved = screen === 'saved';
  const isMap = screen === 'map';
  const source = isResults ? results : isSaved ? videos && videos.filter((v) => saved[v.id]) : videos;
  const error = isResults ? resultsError : feedError;
  const loading = source === null && !error;
  const shown = source?.filter((v) => !filter || v.category === filter) ?? [];
  const savedCount = Object.keys(saved).length;

  const geoVideos = useMemo(
    () => (videos ?? []).filter((v) => v.latitude != null && v.longitude != null && (!filter || v.category === filter)),
    [videos, filter],
  );
  const pickShown = mapPick?.filter((v) => !filter || v.category === filter) ?? null;
  const pickLabel = () => {
    const counts = new Map<string, number>();
    for (const v of pickShown ?? []) {
      if (v.location_tag) counts.set(v.location_tag, (counts.get(v.location_tag) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'here';
  };

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
  const emptyFeed = screen === 'feed' && videos !== null && shown.length === 0;
  const emptySaved = isSaved && !loading && shown.length === 0;

  return (
    <div style={S.root}>
      <nav style={S.nav}>
        <div style={S.logo} onClick={goFeed}>
          HOT<span style={S.logoDot}>SPOT</span>
        </div>
        <SearchBar value={query} onChange={setQuery} onSearch={doSearch} trending={TRENDING} recent={recent} />
        <div style={S.navRight}>
          <button className={isMap ? undefined : 'hs-map-btn'} style={S.mapBtn} onClick={goMap}>
            <span style={{ fontSize: '15px', lineHeight: 1 }}>⌖</span>
            <span>Map</span>
          </button>
          <button style={S.savedBtn} onClick={goSaved}>
            <span style={S.savedHeart}>♥</span>
            <span>Saved</span>
            {savedCount > 0 && <span style={S.savedCount}>{savedCount}</span>}
          </button>
          {user ? (
            <div style={{ position: 'relative' }}>
              <button style={S.avatar} onClick={() => setMenuOpen((o) => !o)} aria-label="Account">
                {(user.email ?? '??').slice(0, 2).toUpperCase()}
              </button>
              {menuOpen && (
                <>
                  <div style={S.menuBackdrop} onMouseDown={() => setMenuOpen(false)} />
                  <div style={S.menu}>
                    <div style={S.menuEmail}>{user.email}</div>
                    <button className="hs-row" style={S.menuOut} onClick={doSignOut}>
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button style={S.savedBtn} onClick={() => setAuthOpen(true)}>
              Sign in
            </button>
          )}
        </div>
      </nav>

      <main style={S.page}>
        {screen === 'feed' && (
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

        {isMap && (
          <div style={S.resultsHead}>
            <div style={S.eyebrow}>The city, mapped</div>
            <h1 style={S.h1}>London hotspots</h1>
            <div style={{ ...S.mastheadSub, marginTop: '8px' }}>
              Where the reels cluster — tap a glow to browse that spot. Saved reels show as ♥ pins.
            </div>
          </div>
        )}

        {isSaved && (
          <div style={S.resultsHead}>
            <div style={S.eyebrow}>Your collection</div>
            <h1 style={S.h1}>Saved spots</h1>
            <div style={{ ...S.mastheadSub, marginTop: '8px' }}>
              {savedCount > 0 ? `${savedCount} reel${savedCount === 1 ? '' : 's'} saved for later` : 'Nothing saved yet'}
            </div>
          </div>
        )}

        {!isSaved && (
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
        )}

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

        {emptySaved && (
          <div style={S.stateWrap}>
            <div style={{ fontSize: '52px', color: p.faint, lineHeight: 1 }}>♡</div>
            <div style={S.stateTitle}>Nothing saved yet</div>
            <div style={S.stateText}>Tap the heart on any reel to keep it here for later.</div>
            <button style={S.stateBtn} onClick={goFeed}>
              Browse the feed
            </button>
          </div>
        )}

        {isMap ? (
          <>
            <MapView videos={geoVideos} savedIds={saved} onSelect={setMapPick} />
            <div style={{ marginTop: '26px' }}>
              {mapPick === null && (
                <div style={S.mapHint}>Tap anywhere glowing to pull up the reels filmed there.</div>
              )}
              {mapPick !== null && pickShown && pickShown.length === 0 && (
                <div style={S.mapHint}>Nothing filmed in this spot yet — try a brighter glow.</div>
              )}
              {pickShown && pickShown.length > 0 && (
                <>
                  <div style={S.eyebrow}>Around {pickLabel()}</div>
                  <h2 style={S.h2}>
                    {pickShown.length} reel{pickShown.length === 1 ? '' : 's'} in this spot
                  </h2>
                  <MasonryGrid
                    items={pickShown.map((v) => (
                      <VideoCard key={v.id} video={v} hearted={!!saved[v.id]} onToggleHeart={toggleHeart} />
                    ))}
                  />
                </>
              )}
            </div>
          </>
        ) : (
          <MasonryGrid
            items={[
              ...(loading
                ? Array.from({ length: 10 }, (_, i) => (
                    <div key={`sk-${i}`}>
                      <div style={S.skThumb} />
                      <div style={S.skBar} />
                    </div>
                  ))
                : []),
              ...shown.map((v) => (
                <VideoCard key={v.id} video={v} hearted={!!saved[v.id]} onToggleHeart={toggleHeart} />
              )),
            ]}
          />
        )}
      </main>

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </div>
  );
}
