import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendMessage } from "@/lib/notify";

export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Service role missing" }, { status: 500 });
  }

  const now = new Date();

  // +2 saat, ama saniyeleri sıfırla (dakika bazlı)
  const from = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  from.setSeconds(0, 0);

  // 10 dakikalık pencere (5 yerine daha toleranslı)
  const to = new Date(from.getTime() + 10 * 60 * 1000);

  const res = await supabaseAdmin
    .from("appointments")
    .select("id, customer_name, customer_phone, start_at, reminder_sent")
    .eq("status", "booked")
    .eq("reminder_sent", false)
    .gte("start_at", from.toISOString())
    .lt("start_at", to.toISOString());

  if (res.error) {
    return NextResponse.json({ error: res.error.message }, { status: 400 });
  }

  const items = res.data ?? [];

  for (const a of items) {
    try {
      await sendMessage({
        phone: a.customer_phone,
        text:
          `Hatırlatma ⏰\n\n` +
          `Merhaba ${a.customer_name},\n` +
          `${new Date(a.start_at).toLocaleString("tr-TR")} saatinde randevunuz var.\n\n` +
          `Lütfen geç kalmayınız.`,
      });
    } catch (e) {
      console.error("notify failed", e);
    }

    await supabaseAdmin
      .from("appointments")
      .update({ reminder_sent: true })
      .eq("id", a.id);
  }

  return NextResponse.json(
    {
      sent: items.length,
      window: { from: from.toISOString(), to: to.toISOString() },
      debug: items.map((x) => ({ id: x.id, start_at: x.start_at })), // local test için
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
