import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
let validUrl = false;
try { validUrl = ['http:', 'https:'].includes(new URL(url).protocol); } catch { /* Invalid configuration uses the setup screen and local demo. */ }
export const configured = Boolean(validUrl && url && key && !url.includes('your-project') && !key.includes('your-publishable'));
export const supabase = configured ? createClient(url, key, { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true } }) : null;
export const appUrl = () => new URL(import.meta.env.BASE_URL, window.location.href).href.split('#')[0].split('?')[0];
