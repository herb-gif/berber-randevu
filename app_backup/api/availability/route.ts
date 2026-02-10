import { NextResponse } from "next/server";
import { supabase } from "../../lib/supabase";

function parseHM(hm: string) {
  const [h, m] = hm.split(":").map((x) => Number(x));
  return { h, m };
}

function toISO(d: Date) {
  return d.toISOString();
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date"); // YYYY-MM-DD
  const durationMin = Number(url.searchParams.get("durationMin") || "0");

  if (!date || !durationMin) {
    return NextResponse.json({ slots: [] });
  }

  // Shop settings
  const settingsRes = await supabase
    .from("shop_settings")
    .select("timezone,open_time,close_time,slot_step_min")
    .eq("id", 1)
    .single();

  if (settingsRes.error) {
    return NextResponse.json({ error: settingsRes.error.message }, { status: 500 });
  }

  const open_time = settingsRes.data.open_time as string;  // "09:00"
  const close_time = settingsRes.data.close_time as string; // "19:00"
  const step = Number(settingsRes.data.slot_step_min ?? 15);

  // Build day boundaries in UTC by assuming inputs are local time in Istanbul-like timezone.
  // For MVP simplicity: treat chosen date as local and construct ISO using Z by shifting with Date parsing.
  // (Later we can do real tz handling.)
  const { h: oh, m: om } = parseHM(open_time);
  const { h: ch, m: cm } = parseHM(close_time);

  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const open = new Date(dayStart);
  open.setUTCHours(oh, om, 0, 0);

  const close = new Date(dayStart);
  close.setUTCHours(ch, cm, 0, 0);

  // Fetch active barbers
  const barbersRes = await supabase
    .from("barbers")
    .select("id")
    .eq("is_active", true);

  if (barbersRes.error) {
    return NextResponse.json({ error: barbersRes.error.message }, { status: 500 });
  }

  const barberIds = (barbersRes.data ?? []).map((b: any) => b.id);
  if (barberIds.length === 0) return NextResponse.json({ slots: [] });

  // Fetch existing appointments for that day (booked only)
  const apptRes = await supabase
    .from("appointments")
    .select("barber_id,start_at,end_at,status")
    .in("barber_id", barberIds)
    .eq("status", "booked")
    .gte("start_at", toISO(open))
    .lt("start_at", toISO(close));

  if (apptRes.error) {
    return NextResponse.json({ error: apptRes.error.message }, { status: 500 });
  }

  const appts = apptRes.data ?? [];

  // Generate candidate slots
  const slots: string[] = [];
  for (let t = new Date(open); t.getTime() + durationMin * 60_000 <= close.getTime(); ) {
    const start = new Date(t);
    const end = new Date(t.getTime() + durationMin * 60_000);

    // Check if ANY barber is free for [start,end)
    const someoneFree = barberIds.some((barberId) => {
      const overlaps = appts.some((a: any) => {
        if (a.barber_id !== barberId) return false;
        const aStart = new Date(a.start_at).getTime();
        const aEnd = new Date(a.end_at).getTime();
        return start.getTime() < aEnd && end.getTime() > aStart;
      });
      return !overlaps;
    });

    if (someoneFree) slots.push(start.toISOString());

    // step forward
    t = new Date(t.getTime() + step * 60_000);
  }

  return NextResponse.json({ slots });
}
