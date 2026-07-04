import { supabase } from './supabase';

// RLS on `saves` scopes every query below to the signed-in user.

export async function fetchSavedIds(): Promise<Set<string>> {
  const { data, error } = await supabase.from('saves').select('video_id');
  if (error) throw new Error(error.message);
  return new Set(data.map((r) => r.video_id as string));
}

export async function addSave(userId: string, videoId: string): Promise<void> {
  // ignoreDuplicates → ON CONFLICT DO NOTHING: re-hearting is a no-op and the
  // conflict path never hits UPDATE, which RLS on `saves` doesn't allow.
  const { error } = await supabase
    .from('saves')
    .upsert({ user_id: userId, video_id: videoId }, { onConflict: 'user_id,video_id', ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}

export async function removeSave(videoId: string): Promise<void> {
  const { error } = await supabase.from('saves').delete().eq('video_id', videoId);
  if (error) throw new Error(error.message);
}
