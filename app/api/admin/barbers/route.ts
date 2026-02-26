import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
})();

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET() {
  const cookieStore = await cookies();
  if (cookieStore.get("admin_session")?.value !== "1") return unauthorized();
  if (!supabaseAdmin) return NextResponse.json({ error: "Service role missing" }, { status: 500 });

  const res = await supabaseAdmin
    .from("barbers")
    .select("id, name, is_active, created_at")
    .order("created_at", { ascending: false });

  if (res.error) return NextResponse.json({ error: res.error.message }, { status: 400 });
  return NextResponse.json({ ok: true, barbers: res.data ?? [] }, { status: 200 });
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  if (cookieStore.get("admin_session")?.value !== "1") return unauthorized();
  if (!supabaseAdmin) return NextResponse.json({ error: "Service role missing" }, { status: 500 });

  const body = (await req.json().catch(() => ({}))) as { name?: string };
  const name = String(body?.name || "").trim();
  if (!name) return NextResponse.json({ error: "Missing name" }, { status: 400 });

  const ins = await supabaseAdmin
    .from("barbers")
    .insert({ name, is_active: true })
    .select("id, name, is_active, created_at")
    .maybeSingle();

  if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 400 });
  return NextResponse.json({ ok: true, barber: ins.data }, { status: 200 });
}

export async function PATCH(req: Request) {
  const cookieStore = await cookies();
  if (cookieStore.get("admin_session")?.value !== "1") return unauthorized();
  if (!supabaseAdmin) return NextResponse.json({ error: "Service role missing" }, { status: 500 });

  const body = (await req.json().catch(() => ({}))) as { id?: string; is_active?: boolean };
  const id = String(body?.id || "");
  const is_active = Boolean(body?.is_active);

  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const upd = await supabaseAdmin
    .from("barbers")
    .update({ is_active })
    .eq("id", id)
    .select("id, name, is_active")
    .maybeSingle();

  if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 400 });
  return NextResponse.json({ ok: true, barber: upd.data }, { status: 200 });
}
