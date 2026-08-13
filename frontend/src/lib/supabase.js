import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: window.localStorage,
  },
});

// Clean up the OAuth hash from the URL only AFTER Supabase has
// successfully processed it into a real session. Stripping it any
// earlier (e.g. before the client initializes) risks deleting a
// fresh, valid token before it's ever read.
supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_IN" && window.location.hash) {
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search
    );
  }
});
