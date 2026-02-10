import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });

  const one = await supabase
    .from("appointments")
    .select("start_at")
    .eq("id", id)
    .single();

  if (one.error || !one.data) {
    return NextResponse.json({ error: "Randevu bulunamadı" }, { status: 404 });
  }

  const start = new Date(one.data.start_at);
  const now = new Date();
  const twoHoursMs = 2 * 60 * 60 * 1000;

  if (start.getTime() - now.getTime() < twoHoursMs) {
    return NextResponse.json(
      { error: "Randevuya 2 saatten az kaldı. İptal edilemez." },
      { status: 403 }
    );
  }

  const upd = await supabase
    .from("appointments")
    .update({ status: "cancelled", deposit_status: "refunded", cancel_reason: "customer" })
    .eq("id", id);

  if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 400 });

  await supabase
    .from("appointment_services")
    .update({ status: "cancelled" })
    .eq("appointment_id", id);

  return NextResponse.json({ ok: true });
}
