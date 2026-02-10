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

  // Bugün (İstanbul saati ile basit yaklaşım)
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const res = await supabaseAdmin
    .from("appointments")
    .select("status, deposit_status, cancel_reason, start_at")
    .gte("start_at", start.toISOString())
    .lte("start_at", end.toISOString());

  if (res.error) {
    return NextResponse.json({ error: res.error.message }, { status: 400 });
  }

  const rows = res.data ?? [];

  const active = rows.filter((r: any) => r.status === "booked").length;
  const cancelled = rows.filter((r: any) => r.status === "cancelled").length;

  const autoCancel = rows.filter((r: any) => r.cancel_reason === "auto_no_deposit").length;
  const adminCancel = rows.filter((r: any) => r.cancel_reason === "admin").length;
  const customerCancel = rows.filter((r: any) => r.cancel_reason === "customer").length;

  const pending = rows.filter((r: any) => r.deposit_status === "pending").length;
  const paid = rows.filter((r: any) => r.deposit_status === "paid").length;
  const forfeited = rows.filter((r: any) => r.deposit_status === "forfeited").length;

  return NextResponse.json({
    ok: true,
    today: {
      active,
      cancelled,
      autoCancel,
      adminCancel,
      customerCancel,
      deposit: { pending, paid, forfeited },
    },
  }, { headers: { "Cache-Control": "no-store" } });
}
