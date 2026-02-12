import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";

type ResourceGroup = "hair" | "niyazi" | "external" | null;

function isRG(x: any): x is Exclude<ResourceGroup, null> {
  return x === "hair" || x === "niyazi" || x === "external";
}

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
    .select("id,name,service_type,resource_group,price,is_active,default_duration_min")
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

  const body = (await req.json().catch(() => ({} as any))) as any;

  const id = String(body.id || "").trim();
  if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });

  const patch: Record<string, any> = {};

  if ("price" in body) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0) return NextResponse.json({ error: "price geçersiz" }, { status: 400 });
    patch.price = Math.round(price);
  }

  if ("is_active" in body) {
    if (typeof body.is_active !== "boolean") {
      return NextResponse.json({ error: "is_active boolean olmalı" }, { status: 400 });
    }
    patch.is_active = body.is_active;
  }

  if ("resource_group" in body) {
    const raw = body.resource_group;
    const v: any = raw === "" || raw === undefined ? null : raw;
    if (v !== null && !isRG(v)) {
      return NextResponse.json({ error: "resource_group geçersiz (hair|niyazi|external|null)" }, { status: 400 });
    }
    patch.resource_group = v as ResourceGroup;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Güncellenecek alan yok" }, { status: 400 });
  }

  const upd = await supabaseAdmin.from("services").update(patch).eq("id", id).select("*").single();

  if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 400 });
  return NextResponse.json({ ok: true, row: upd.data }, { headers: { "Cache-Control": "no-store" } });
}
