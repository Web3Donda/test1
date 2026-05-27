import { createClient, SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'product-images';

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) {
    throw new Error('Supabase Storage не настроен: добавьте VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в переменные окружения.');
  }
  client = createClient(url, key);
  return client;
}

export async function uploadProductImage(file: File): Promise<string> {
  const supabase = getClient();
  const ext = file.name.split('.').pop() || 'jpg';
  const filename = `products/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(filename, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}
