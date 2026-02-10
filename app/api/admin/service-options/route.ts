import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: Request) {
  const cookieStore = await cookies();
  if (cookieStore.get("admin_session")?.value !== "1") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) return NextResponse.json({ error: "Service role missing" }, { status: 500 });

  const url = new URL(req.url);
  const service_id = url.searchParams.get("service_id");
  if (!service_id) return NextResponse.json({ error: "service_id gerekli" }, { status: 400 });

  const res = await supabaseAdmin
    .from("service_options")
    .select("id,service_id,name,price,duration_min,is_active,sort_order,created_at")
    .eq("service_id", service_id)
    .order("sort_order", { ascending: true });

  if (res.error) return NextResponse.json({ error: res.error.message }, { status: 400 });
  return NextResponse.json({ rows: res.data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  if (cookieStore.get("admin_session")?.value !== "1") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) return NextResponse.json({ error: "Service role missing" }, { status: 500 });

  const body = await req.json().catch(() => ({} as any));
  const id = String(body.id || "").trim();
  if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });

  const patch: any = {};
  if (body.price !== undefined) {
    const v = Number(body.price);
    if (!Number.isFinite(v) || v < 0) return NextResponse.json({ error: "price geçersiz" }, { status: 400 });
    patch.price = Math.round(v);
  }
  if (body.duration_min !== undefined) {
    const v = Number(body.duration_min);
    if (!Number.isFinite(v) || v < 0) return NextResponse.json({ error: "duration_min geçersiz" }, { status: 400 });
    patch.duration_min = Math.round(v);
  }
  if (body.sort_order !== undefined) {
    const v = Number(body.sort_order);
    if (!Number.isFinite(v) || v < 0) return NextResponse.json({ error: "sort_order geçersiz" }, { status: 400 });
    patch.sort_order = Math.round(v);
  }
  if (body.is_active !== undefined) {
    patch.is_active = !!body.is_active;
  }

  const upd = await supabaseAdmin
    .from("service_options")
    .update(patch)
    .eq("id", id)
    .select("id,price,duration_min,is_active,sort_order")
    .single();

  if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 400 });
  return NextResponse.json({ ok: true, row: upd.data }, { headers: { "Cache-Control": "no-store" } });
}
