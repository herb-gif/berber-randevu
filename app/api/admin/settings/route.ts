import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const cookieStore = await cookies();
  if (cookieStore.get("admin_session")?.value !== "1") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Service role missing" }, { status: 500 });
  }

  const res = await supabaseAdmin
    .from("capacity_settings")
    .select("value")
    .eq("name", "deposit_percent")
    .single();

  if (res.error) return NextResponse.json({ error: res.error.message }, { status: 400 });

  return NextResponse.json(
    { deposit_percent: Number(res.data?.value ?? 20) },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  if (cookieStore.get("admin_session")?.value !== "1") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Service role missing" }, { status: 500 });
  }

  const body = (await req.json().catch(() => ({}))) as any;
  const v = Number(body.deposit_percent);

  if (!Number.isFinite(v) || v < 0 || v > 100) {
    return NextResponse.json({ error: "deposit_percent 0-100 arası olmalı" }, { status: 400 });
  }

  const up = await supabaseAdmin
    .from("capacity_settings")
    .upsert({ name: "deposit_percent", value: Math.round(v) }, { onConflict: "name" });

  if (up.error) return NextResponse.json({ error: up.error.message }, { status: 400 });

  return NextResponse.json(
    { ok: true, deposit_percent: Math.round(v) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
