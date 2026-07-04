import type { CSSProperties } from 'react';
import { pal } from './palette';
import type { Category, Platform, Video } from './types';

export const ACCENT = '#ff2d6f';
const p = pal('Paper');

const PLATFORMS: Record<Platform, { label: string; glyph: string }> = {
  tiktok: { label: 'TikTok', glyph: '♪' },
  instagram: { label: 'Instagram', glyph: '◉' },
  youtube: { label: 'YouTube', glyph: '▶' },
};

// Gradient pairs for rows without a stored thumbnail (Instagram — see ingest.js).
const TONES: Record<Category, [string, string]> = {
  food: ['#f2ab3c', '#b1372a'],
  views: ['#ff9a52', '#ff2d6f'],
  nightlife: ['#8a54ea', '#241452'],
  thingstodo: ['#22ad8c', '#0d463d'],
  culture: ['#5486cf', '#1d2c4f'],
};
const DEFAULT_TONE: [string, string] = ['#7d8698', '#232936'];

type Style = CSSProperties & Record<string, unknown>;

const S: Record<string, Style> = {
  card: { width: '100%', cursor: 'pointer' },
  thumb: {
    position: 'relative',
    borderRadius: '18px',
    overflow: 'hidden',
    aspectRatio: '9 / 16',
    background: '#0c0a10',
    boxShadow: '0 6px 18px -10px rgba(20,10,20,.4)',
    transition: 'box-shadow .24s',
  },
  media: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transformOrigin: 'center',
    transition: 'transform .55s cubic-bezier(.2,.7,.3,1)',
  },
  fallbackTitle: {
    font: "600 clamp(17px,1.6vw,22px)/1.15 'Oswald',sans-serif",
    letterSpacing: '.3px',
    color: '#fff',
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 4,
    WebkitBoxOrient: 'vertical',
  },
  fallbackGlyph: { font: "400 30px/1 'Archivo',sans-serif", color: 'rgba(255,255,255,.85)' },
  fallbackTag: {
    font: "700 10.5px 'Archivo',sans-serif",
    letterSpacing: '1.4px',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,.72)',
  },
  badge: {
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
  title: {
    font: "600 15px/1.22 'Oswald',sans-serif",
    letterSpacing: '.2px',
    color: p.ink,
    marginTop: '9px',
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  },
  meta: {
    font: "500 11.5px/1.3 'Archivo',sans-serif",
    color: p.mut,
    marginTop: '3px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
};

export interface VideoCardProps {
  video: Video;
  hearted: boolean;
  onToggleHeart: (id: string) => void;
}

export default function VideoCard({ video, hearted, onToggleHeart }: VideoCardProps) {
  const plat = PLATFORMS[video.platform];
  const [tone0, tone1] = (video.category && TONES[video.category]) || DEFAULT_TONE;
  const title = video.title ?? (video.location_tag ? `Spotted in ${video.location_tag}` : 'Spotted in London');
  const metaParts = [video.author, video.location_tag].filter(Boolean);

  const heartStyle: Style = {
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
    background: hearted ? 'rgba(255,255,255,.95)' : 'rgba(14,10,16,.42)',
    color: hearted ? ACCENT : '#fff',
    backdropFilter: 'blur(7px)',
    WebkitBackdropFilter: 'blur(7px)',
    opacity: hearted ? 1 : 0,
    animation: hearted ? 'hsPop .4s ease' : 'none',
  };

  return (
    <div
      className="hsc"
      style={S.card}
      onClick={() => window.open(video.original_url, '_blank', 'noopener')}
    >
      <div className="hsc-thumb" style={S.thumb}>
        {video.thumbnail_url ? (
          <img className="hsc-media" src={video.thumbnail_url} alt={title} loading="lazy" style={S.media} />
        ) : (
          <div
            className="hsc-media"
            style={{
              ...S.media,
              background: `radial-gradient(120% 85% at 28% 8%, rgba(255,255,255,.22), transparent 55%), linear-gradient(158deg, ${tone0} 0%, ${tone1} 100%)`,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              gap: '10px',
              padding: '18px',
            }}
          >
            <span style={S.fallbackGlyph}>{plat.glyph}</span>
            <span style={S.fallbackTitle}>{title}</span>
            {video.location_tag && <span style={S.fallbackTag}>{video.location_tag}</span>}
          </div>
        )}
        <span style={S.badge}>
          {plat.glyph}&nbsp;&nbsp;{plat.label}
        </span>
        <button
          className="hsc-heart"
          style={heartStyle}
          aria-label={hearted ? 'Remove from saved' : 'Save'}
          onClick={(e) => {
            e.stopPropagation();
            onToggleHeart(video.id);
          }}
        >
          {hearted ? '♥' : '♡'}
        </button>
      </div>
      <div style={{ padding: '0 2px' }}>
        <div style={S.title}>{title}</div>
        {metaParts.length > 0 && <div style={S.meta}>{metaParts.join('  ·  ')}</div>}
      </div>
    </div>
  );
}
