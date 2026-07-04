export type Platform = 'tiktok' | 'instagram' | 'youtube';
export type Category = 'food' | 'views' | 'nightlife' | 'thingstodo' | 'culture';

// Row shape of the Supabase `videos` table (see docs/architecture.md).
export interface Video {
  id: string;
  platform: Platform;
  original_url: string;
  embed_url: string | null;
  thumbnail_url: string | null;
  title: string | null;
  author: string | null;
  hashtags: string[] | null;
  category: Category | null;
  location_tag: string | null;
  created_at: string;
  place_name: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  geocoded_at: string | null;
}
