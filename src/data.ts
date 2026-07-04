export type Platform = 'tiktok' | 'instagram' | 'youtube';
export type Category = 'views' | 'food' | 'nightlife' | 'sightseeing' | 'activities';

export interface PoolItem {
  id: string;
  title: string;
  handle: string;
  place: string;
  platform: Platform;
  category: Category;
  likes: number;
}

export interface FeedItem extends PoolItem {
  uid: string;
  aspect: number;
}

export const POOL: PoolItem[] = [
  { id: '1', title: 'Golden hour over Peckham', handle: '@lookup.london', place: 'Peckham', platform: 'tiktok', category: 'views', likes: 24800 },
  { id: '2', title: 'Best ramen in Dalston', handle: '@dalston.eats', place: 'Dalston', platform: 'instagram', category: 'food', likes: 18200 },
  { id: '3', title: 'Rooftop bars, Shoreditch', handle: '@nightsout.ldn', place: 'Shoreditch', platform: 'tiktok', category: 'nightlife', likes: 41300 },
  { id: '4', title: 'Sky Garden at sunset', handle: '@skyline.city', place: 'City', platform: 'youtube', category: 'views', likes: 9700 },
  { id: '5', title: 'Columbia Road flower market', handle: '@sunday.blooms', place: 'Bethnal Green', platform: 'instagram', category: 'sightseeing', likes: 33100 },
  { id: '6', title: 'Little Venice canal walk', handle: '@slow.london', place: 'Maida Vale', platform: 'youtube', category: 'sightseeing', likes: 7600 },
  { id: '7', title: 'Brixton night market', handle: '@brixton.afterdark', place: 'Brixton', platform: 'tiktok', category: 'nightlife', likes: 28400 },
  { id: '8', title: 'Hampstead Heath wild swim', handle: '@ponds.club', place: 'Hampstead', platform: 'instagram', category: 'activities', likes: 15900 },
  { id: '9', title: 'Borough Market, first bite', handle: '@borough.bites', place: 'London Bridge', platform: 'tiktok', category: 'food', likes: 52700 },
  { id: '10', title: 'Camden after midnight', handle: '@camden.nocturne', place: 'Camden', platform: 'instagram', category: 'nightlife', likes: 21100 },
  { id: '11', title: 'Greenwich Park viewpoint', handle: '@meridian.views', place: 'Greenwich', platform: 'youtube', category: 'views', likes: 12300 },
  { id: '12', title: 'Southbank skate spot', handle: '@concrete.ldn', place: 'Southbank', platform: 'tiktok', category: 'activities', likes: 19800 },
  { id: '13', title: 'Maltby Street brunch run', handle: '@weekend.ldn', place: 'Bermondsey', platform: 'instagram', category: 'food', likes: 26600 },
  { id: '14', title: 'Primrose Hill skyline', handle: '@primrose.hour', place: 'Primrose Hill', platform: 'tiktok', category: 'views', likes: 37200 },
  { id: '15', title: 'Notting Hill in bloom', handle: '@pastel.streets', place: 'Notting Hill', platform: 'instagram', category: 'sightseeing', likes: 29900 },
  { id: '16', title: 'Dalston nightlife crawl', handle: '@late.ldn', place: 'Dalston', platform: 'tiktok', category: 'nightlife', likes: 34500 },
  { id: '17', title: 'Kayaking the Thames', handle: '@tidal.ldn', place: 'Putney', platform: 'youtube', category: 'activities', likes: 8400 },
  { id: '18', title: 'Peckham Levels sunset', handle: '@rooftop.se15', place: 'Peckham', platform: 'instagram', category: 'views', likes: 44800 },
];

export const TRENDING: { text: string; tag: Category }[] = [
  { text: 'golden hour south london', tag: 'views' },
  { text: 'best ramen dalston', tag: 'food' },
  { text: 'rooftop bars shoreditch', tag: 'nightlife' },
  { text: 'columbia road flower market', tag: 'sightseeing' },
  { text: 'peckham levels sunset', tag: 'views' },
  { text: 'brixton night market', tag: 'nightlife' },
];

export const RECENT: string[] = ['sky garden tickets', 'hampstead heath ponds'];

export const PLATFORMS: Record<Platform, { label: string; glyph: string }> = {
  tiktok: { label: 'TikTok', glyph: '♪' },
  instagram: { label: 'Instagram', glyph: '◉' },
  youtube: { label: 'YouTube', glyph: '▶' },
};

export const URLS: Record<Platform, string> = {
  tiktok: 'https://www.tiktok.com',
  instagram: 'https://www.instagram.com/reels',
  youtube: 'https://www.youtube.com/shorts',
};

export const TONES: Record<Category, [string, string]> = {
  views: ['#ff9a52', '#ff2d6f'],
  food: ['#f2ab3c', '#b1372a'],
  nightlife: ['#8a54ea', '#241452'],
  sightseeing: ['#5486cf', '#1d2c4f'],
  activities: ['#22ad8c', '#0d463d'],
};

export const ASPECTS = [0.56, 0.66, 0.74, 0.54, 0.6, 0.7, 0.58, 0.64];

export function buildFeed(): FeedItem[] {
  const out: FeedItem[] = [];
  let i = 0;
  for (let k = 0; k < 4; k++) {
    POOL.forEach((p) => {
      out.push({ ...p, uid: `${p.id}-${k}`, aspect: ASPECTS[i % ASPECTS.length], likes: p.likes + k * 430 });
      i++;
    });
  }
  return out;
}

export function fmt(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k';
  return '' + n;
}

export function slug(w: string): string {
  return '#' + w.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function catFilter(name: string): Category[] | null {
  switch (name) {
    case 'Views':
      return ['views', 'sightseeing'];
    case 'Food':
      return ['food'];
    case 'Nightlife':
      return ['nightlife'];
    case 'Activities':
      return ['activities'];
    default:
      return null;
  }
}

export function matches(it: FeedItem, q: string): boolean {
  if (!q) return true;
  const s = `${it.title} ${it.place} ${it.category} ${it.handle}`.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .some((w) => w.length > 2 && s.includes(w));
}
