import { createClient } from "@supabase/supabase-js";

// Strip any stale OAuth hash from the URL before Supabase's client
// initializes. Browser autocomplete can replay an old URL that still
// has a leftover "#access_token=..." fragment from a previous sign-in,
// and if Supabase processes that stale hash on load, it can break the
// real session already stored in localStorage. This must run
// synchronously here, before createClient() runs — a React useEffect
// fires too late to prevent it.
if (window.location.hash && window.location.hash.includes("access_token")) {
  window.history.replaceState(
    null,
    "",
    window.location.pathname + window.location.search
  );
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: window.localStorage,
  },
});
