import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const configured = Boolean(url && key);

// Placeholders keep createClient from throwing when env vars are missing;
// App shows a setup message instead of using this client.
export const supabase = createClient(url || 'http://localhost', key || 'missing');
