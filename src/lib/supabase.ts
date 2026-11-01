import { createClient } from '@supabase/supabase-js';

function cleanUrl(raw: string | undefined): string | undefined {
  const s = raw?.trim();
  if (!s) return undefined;
  try {
    // Keep only the origin: a pasted ".../rest/v1/" or trailing slash breaks every request.
    return new URL(s).origin;
  } catch {
    return s;
  }
}

const url = cleanUrl(import.meta.env.VITE_SUPABASE_URL as string | undefined);
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

export const configured = Boolean(url && key);

// Placeholders keep createClient from throwing when env vars are missing;
// App shows a setup message instead of using this client.
export const supabase = createClient(url || 'http://localhost', key || 'missing');
