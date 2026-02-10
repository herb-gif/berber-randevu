import { createClient } from "@supabase/supabase-js";

// Client/anon (tarayıcı + RLS)
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
export const supabase = createClient(url, anon);

// Server/admin (RLS bypass) — SADECE server route'larda kullan
const serviceUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const supabaseAdmin = serviceKey
  ? createClient(serviceUrl, serviceKey, {
      auth: { persistSession: false },
    })
  : null;
