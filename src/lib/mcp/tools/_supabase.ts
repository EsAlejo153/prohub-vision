import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

// External Supabase project (user-managed). Both values are the public
// project URL and anon key, safe to embed. RLS + the forwarded user token
// enforce access.
export const EXTERNAL_SUPABASE_URL = "https://srbyogadhamglfatjlbx.supabase.co";
export const EXTERNAL_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyYnlvZ2FkaGFtZ2xmYXRqbGJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0OTQwNzEsImV4cCI6MjA5MzA3MDA3MX0.YPBOAFa4uABQFejONlu0B2P57WRA8ggvtcY6HtmxsmM";

export function supabaseForUser(ctx: ToolContext) {
  return createClient(EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}