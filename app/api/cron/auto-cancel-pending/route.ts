import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendMessage } from "@/lib/notify";
import { DISPLAY_TZ } from "@/lib/timezone";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const url = new URL(req.url);
    const provided = url.searchParams.get("secret") || req.headers.get("x-cron-secret");
    if (provided !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Service role missing" }, { status: 500 });
  }

  // Ayarları DB’den oku (default: 15 ve 30)
  const settingsRes = await supabaseAdmin
    .from("capacity_settings")
    .select("name,value")
    .in("name", ["auto_cancel_after_min", "auto_cancel_min_start_buffer_min"]);

  const map = new Map((settingsRes.data ?? []).map((x: any) => [x.name, x.value]));
  const afterMin = Number(map.get("auto_cancel_after_min") ?? 15);
  const bufferMin = Number(map.get("auto_cancel_min_start_buffer_min") ?? 30);

  const now = new Date();
  const cutoff = new Date(now.getTime() - afterMin * 60 * 1000);
  const minStart = new Date(now.getTime() + bufferMin * 60 * 1000);

  const res = await supabaseAdmin
    .from("appointments")
    .select("id, customer_name, customer_phone, start_at, booking_time, deposit_status, status")
    .eq("status", "booked")
    .eq("deposit_status", "pending")
    .lt("booking_time", cutoff.toISOString())
    .gt("start_at", minStart.toISOString());

  if (res.error) {
    return NextResponse.json({ error: res.error.message }, { status: 400 });
  }

  const items = res.data ?? [];

  for (const a of items) {
    const upd1 = await supabaseAdmin
      .from("appointments")
      .update({ status: "cancelled", deposit_status: "cancelled", cancel_reason: "auto_no_deposit" })
      .eq("id", a.id);

    if (upd1.error) continue;

    await supabaseAdmin
      .from("appointment_services")
      .update({ status: "cancelled" })
      .eq("appointment_id", a.id);

    try {
      await sendMessage({
        phone: a.customer_phone,
        text:
          `Merhaba ${a.customer_name},\n\n` +
          `Randevunuz otomatik iptal edildi.\n` +
          `Sebep: ${afterMin} dakika içinde depozito dekontu iletilmedi.\n\n` +
          `Randevu zamanı: ${new Date(a.start_at).toLocaleString("tr-TR", { timeZone: DISPLAY_TZ })}\n` +
          `Durum: cancelled`,
      });
    } catch {}
  }

  return NextResponse.json(
    {
      ok: true,
      cancelled: items.length,
      rules: { auto_cancel_after_min: afterMin, start_buffer_min: bufferMin },
      cutoff: cutoff.toISOString(),
      minStart: minStart.toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
