import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request) {
  const cookieStore = await cookies();
  if (cookieStore.get("admin_session")?.value !== "1") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) return NextResponse.json({ error: "Service role missing" }, { status: 500 });

  const body = await req.json().catch(() => ({} as any));
  const id = String(body.id || "").trim();
  if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });

  const upd = await supabaseAdmin
    .from("appointments")
    .update({ status: "booked" })
    .eq("id", id)
    .select("id,status")
    .single();

  if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 400 });
  return NextResponse.json({ ok: true, row: upd.data }, { headers: { "Cache-Control": "no-store" } });
}
