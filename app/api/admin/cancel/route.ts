import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  const cookieStore = await cookies();
  if (cookieStore.get("admin_session")?.value !== "1") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Service role missing" }, { status: 500 });
  }

  const url = new URL(req.url);
  const idQ = url.searchParams.get("id");
  const body = await req.json().catch(() => ({} as any));
  const id = String(idQ || body.id || "").trim();

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Geçersiz id" }, { status: 400 });
  }

  // Randevuyu çek (debug için de iyi)
  const one = await supabaseAdmin
    .from("appointments")
    .select("id,status,deposit_status,start_at")
    .eq("id", id)
    .single();

  if (one.error) {
    return NextResponse.json({ error: one.error.message }, { status: 400 });
  }

  // 2 saatten az kala -> depozito yansın
  const startMs = Date.parse(one.data.start_at);
  const diffMin = Math.floor((startMs - Date.now()) / 60_000);
  const late = diffMin < 120;
    const currentDeposit = one.data.deposit_status ?? null;
    const nextDeposit = currentDeposit === "paid" ? "refunded" : currentDeposit;
  // 1) appointments update
  const updA = await supabaseAdmin
    .from("appointments")
    .update({
      status: "cancelled",
      deposit_status: nextDeposit,
      cancel_reason: "admin",
    })
    .eq("id", id)
    .select("id,status,deposit_status,cancel_reason")
    .single();

  if (updA.error) {
    return NextResponse.json({ error: updA.error.message }, { status: 400 });
  }

  // 2) blocks update (slot açılsın)
  const updB = await supabaseAdmin
    .from("appointment_services")
    .update({ status: "cancelled" })
    .eq("appointment_id", id);

  if (updB.error) {
    return NextResponse.json({ error: updB.error.message }, { status: 400 });
  }

  return NextResponse.json(
    { ok: true, row: updA.data, late },
    { headers: { "Cache-Control": "no-store" } }
  );
}
