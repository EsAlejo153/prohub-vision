import { createClient } from "@supabase/supabase-js";

// External Supabase project (user-managed, not Lovable Cloud).
const SUPABASE_URL = "https://srbyogadhamglfatjlbx.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyYnlvZ2FkaGFtZ2xmYXRqbGJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0OTQwNzEsImV4cCI6MjA5MzA3MDA3MX0.YPBOAFa4uABQFejONlu0B2P57WRA8ggvtcY6HtmxsmM";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});