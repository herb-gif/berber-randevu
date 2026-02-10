import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const isAdmin = (await cookies()).get("admin_session")?.value === "1";
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Service role missing" }, { status: 500 });
  }

  const res = await supabaseAdmin
    .from("capacity_settings")
    .select("name,value")
    .order("name");

  if (res.error) return NextResponse.json({ error: res.error.message }, { status: 400 });
  return NextResponse.json({ items: res.data ?? [] });
}

export async function POST(req: Request) {
  const isAdmin = (await cookies()).get("admin_session")?.value === "1";
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Service role missing" }, { status: 500 });
  }

  const { name, value } = await req.json().catch(() => ({}));
  if (!name || typeof value !== "number") {
    return NextResponse.json({ error: "name ve value gerekli" }, { status: 400 });
  }

  const up = await supabaseAdmin
    .from("capacity_settings")
    .update({ value })
    .eq("name", name);

  if (up.error) return NextResponse.json({ error: up.error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
