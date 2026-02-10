import { NextResponse } from "next/server";
import { supabase } from "../../lib/supabase";

type ItemInput = { serviceId: string; durationMin?: number };

export async function POST(req: Request) {
  const body = await req.json();
  const start_at = body.start_at as string;
  const customer_name = (body.customer_name as string) ?? "";
  const customer_phone = (body.customer_phone as string) ?? "";
  const items = (body.items as ItemInput[]) ?? [];

  if (!start_at || !customer_name.trim() || !customer_phone.trim() || items.length === 0) {
    return NextResponse.json({ error: "Eksik bilgi" }, { status: 400 });
  }

  // Determine total duration from services
  const serviceIds = items.map((i) => i.serviceId);

  const servicesRes = await supabase
    .from("services")
    .select("id,default_duration_min,is_variable_duration,min_duration_min,max_duration_min,is_active")
    .in("id", serviceIds)
    .eq("is_active", true);

  if (servicesRes.error) {
    return NextResponse.json({ error: servicesRes.error.message }, { status: 500 });
  }

  const services = servicesRes.data ?? [];
  if (services.length !== serviceIds.length) {
    return NextResponse.json({ error: "Hizmet bulunamadı" }, { status: 400 });
  }

  const durationMin = services.reduce((sum: number, s: any) => {
    const item = items.find((i) => i.serviceId === s.id)!;
    if (s.is_variable_duration) {
      const d = Number(item.durationMin ?? s.default_duration_min);
      return sum + d;
    }
    return sum + Number(s.default_duration_min);
  }, 0);

  const start = new Date(start_at);
  const end = new Date(start.getTime() + durationMin * 60_000);

  // Pick an available barber (first-fit)
  const barbersRes = await supabase.from("barbers").select("id").eq("is_active", true);
  if (barbersRes.error) return NextResponse.json({ error: barbersRes.error.message }, { status: 500 });

  const barberIds = (barbersRes.data ?? []).map((b: any) => b.id);
  if (barberIds.length === 0) return NextResponse.json({ error: "Aktif berber yok" }, { status: 400 });

  // Fetch overlapping appointments for this interval
  const overlapRes = await supabase
    .from("appointments")
    .select("barber_id,start_at,end_at,status")
    .in("barber_id", barberIds)
    .eq("status", "booked")
    .lt("start_at", end.toISOString())
    .gt("end_at", start.toISOString());

  if (overlapRes.error) {
    return NextResponse.json({ error: overlapRes.error.message }, { status: 500 });
  }

  const overlaps = overlapRes.data ?? [];

  const chosenBarber = barberIds.find((barberId) => {
    const hasOverlap = overlaps.some((a: any) => a.barber_id === barberId);
    return !hasOverlap;
  });

  if (!chosenBarber) {
    return NextResponse.json({ error: "Bu saatte müsait berber yok" }, { status: 409 });
  }

  // Insert appointment
  const apptInsert = await supabase
    .from("appointments")
    .insert({
      barber_id: chosenBarber,
      customer_name,
      customer_phone,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      status: "booked",
    })
    .select("id")
    .single();

  if (apptInsert.error) {
    return NextResponse.json({ error: apptInsert.error.message }, { status: 500 });
  }

  const appointment_id = apptInsert.data.id as string;

  // Insert items
  const itemRows = services.map((s: any) => {
    const item = items.find((i) => i.serviceId === s.id)!;
    const d = s.is_variable_duration ? Number(item.durationMin ?? s.default_duration_min) : Number(s.default_duration_min);
    return { appointment_id, service_id: s.id, duration_min: d };
  });

  const itemsInsert = await supabase.from("appointment_items").insert(itemRows);
  if (itemsInsert.error) {
    return NextResponse.json({ error: itemsInsert.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, appointment_id });
}
