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
    .from("services")
    .select("id,name,service_type,price,is_active,default_duration_min")
    .order("service_type")
    .order("name");

  if (res.error) return NextResponse.json({ error: res.error.message }, { status: 400 });
  return NextResponse.json({ rows: res.data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  if (cookieStore.get("admin_session")?.value !== "1") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Service role missing" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({} as any));
  const id = String(body.id || "").trim();
  const price = Number(body.price);

  if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });
  if (!Number.isFinite(price) || price < 0) return NextResponse.json({ error: "price geçersiz" }, { status: 400 });

  const upd = await supabaseAdmin
    .from("services")
    .update({ price: Math.round(price) })
    .eq("id", id)
    .select("id,price")
    .single();

  if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 400 });
  return NextResponse.json({ ok: true, row: upd.data }, { headers: { "Cache-Control": "no-store" } });
}
