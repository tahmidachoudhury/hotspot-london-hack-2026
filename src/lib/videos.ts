import { supabase } from './supabase';
import type { Video } from '../types';

export async function fetchAllVideos(): Promise<Video[]> {
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data as Video[];
}

// Sanitized to [a-z0-9] so words are safe to splice into a PostgREST .or() string.
export function searchWords(term: string): string[] {
  return term
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ''))
    .filter((w) => w.length > 2);
}

function haystack(v: Video): string {
  return [v.title, v.location_tag, v.author, v.category, v.place_name, ...(v.hashtags ?? [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/**
 * Any-word match server-side (ilike per word across the text columns, plus
 * exact hashtag containment), then ranked client-side by how many distinct
 * words hit — the client pass also catches mixed-case hashtags that `cs`
 * misses (`#LondonRooftops` vs `{#londonrooftops}`).
 */
export async function searchVideos(term: string): Promise<Video[]> {
  const words = searchWords(term);
  if (words.length === 0) return [];

  const conds = words.flatMap((w) => [
    `title.ilike.%${w}%`,
    `location_tag.ilike.%${w}%`,
    `author.ilike.%${w}%`,
    `category.ilike.%${w}%`,
    `place_name.ilike.%${w}%`,
    `hashtags.cs.{#${w}}`,
  ]);

  const { data, error } = await supabase.from('videos').select('*').or(conds.join(','));
  if (error) throw new Error(error.message);

  return (data as Video[])
    .map((v) => {
      const hay = haystack(v);
      return { v, score: words.filter((w) => hay.includes(w)).length };
    })
    .sort((a, b) => b.score - a.score)
    .map((s) => s.v);
}
