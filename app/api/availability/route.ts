import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { buildSegments, overlaps, sortServices, type ServiceRow, normalizeType, resourceFor } from "@/lib/scheduling";
import { getWorkWindow } from "@/lib/workHours";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  const serviceIdsRaw = url.searchParams.get("serviceIds") || url.searchParams.get("service_ids");
  const barberIdRaw = url.searchParams.get("barberId") || url.searchParams.get("barber_id");

  if (!date) return NextResponse.json({ error: "date gerekli" }, { status: 400 });
  if (!serviceIdsRaw) return NextResponse.json({ error: "serviceIds gerekli" }, { status: 400 });

  const serviceIds = serviceIdsRaw
    .split(",")
    .map((x) => x.trim())
    .filter((x) => UUID_RE.test(x));

  if (serviceIds.length === 0) return NextResponse.json({ error: "serviceIds boş" }, { status: 400 });

  const barberId = barberIdRaw && UUID_RE.test(barberIdRaw.trim()) ? barberIdRaw.trim() : null;

  const win = getWorkWindow(date);
  const baseMs = Date.parse(`${date}T00:00:00+02:00`);
  const dayStartISO = new Date(baseMs + win.openMin * 60_000).toISOString();
  const dayEndISO = new Date(baseMs + 24 * 60 * 60_000).toISOString();

  const svc = await supabase
    .from("services")
    .select("id,name,default_duration_min,service_type,resource_group,is_active")
    .in("id", serviceIds);

  if (svc.error) return NextResponse.json({ error: svc.error.message }, { status: 400 });

  const services = (svc.data ?? []).filter((s: any) => s.is_active) as any[];
  if (services.length !== serviceIds.length) {
    return NextResponse.json({ error: "Bazı hizmetler pasif veya bulunamadı" }, { status: 400 });
  }

  const ordered = sortServices(services as any as ServiceRow[]);

  const needsHair = ordered.some((s: any) => resourceFor(s) === "hair");
  const needsNiyazi = ordered.some((s: any) => resourceFor(s) === "niyazi");
  const needsExternal = ordered.some((s: any) => resourceFor(s) === "external");

  if (needsHair && !barberId) return NextResponse.json({ error: "Berber seçmelisiniz" }, { status: 400 });

  let niyaziCapacity = 1;
  if (needsNiyazi) {
    const cap = await supabase.from("capacity_settings").select("value").eq("name", "niyazi_capacity").single();
    niyaziCapacity = cap.data?.value ?? 1;
    if (niyaziCapacity <= 0) return NextResponse.json({ slots: [] }, { headers: { "Cache-Control": "no-store" } });
  }

  const [hairBusyRes, niyaziBusyRes, externalBusyRes] = await Promise.all([
    needsHair
      ? supabase
          .from("appointment_services")
          .select("start_at,end_at,status")
          .eq("resource", "hair")
          .eq("barber_id", barberId as string)
          .neq("status", "cancelled")
          .lt("start_at", dayEndISO)
          .gt("end_at", dayStartISO)
      : Promise.resolve({ data: [], error: null } as any),

    needsNiyazi
      ? supabase
          .from("appointment_services")
          .select("start_at,end_at,status")
          .eq("resource", "niyazi")
          .neq("status", "cancelled")
          .lt("start_at", dayEndISO)
          .gt("end_at", dayStartISO)
      : Promise.resolve({ data: [], error: null } as any),

    needsExternal
      ? supabase
          .from("appointment_services")
          .select("start_at,end_at,status")
          .eq("resource", "external")
          .neq("status", "cancelled")
          .lt("start_at", dayEndISO)
          .gt("end_at", dayStartISO)
      : Promise.resolve({ data: [], error: null } as any),
  ]);

  if (hairBusyRes.error) return NextResponse.json({ error: hairBusyRes.error.message }, { status: 400 });
  if (niyaziBusyRes.error) return NextResponse.json({ error: niyaziBusyRes.error.message }, { status: 400 });
  if (externalBusyRes.error) return NextResponse.json({ error: externalBusyRes.error.message }, { status: 400 });

  const hairBusy = (hairBusyRes.data ?? []).map((a: any) => ({ s: Date.parse(a.start_at), e: Date.parse(a.end_at) }));
  const niyaziBusy = (niyaziBusyRes.data ?? []).map((a: any) => ({ s: Date.parse(a.start_at), e: Date.parse(a.end_at) }));
  const externalBusy = (externalBusyRes.data ?? []).map((a: any) => ({ s: Date.parse(a.start_at), e: Date.parse(a.end_at) }));

  const stepMin = 15;
  const slots: string[] = [];

  // Son başlangıç: hair-only daha erken kapanır.
  // Hair + başka servis (mixed) => admin karar versin: müşteri alabilsin (other penceresi).
  const isMixed = needsHair && (needsNiyazi || needsExternal);
  const lastStartMin = needsHair
    ? (isMixed ? win.lastStartOtherMin : win.lastStartHairMin)
    : win.lastStartOtherMin;


  // TR(+03) "bugün" ISO (YYYY-MM-DD)
  const todayTR = new Date(Date.now() + 2 * 60 * 60_000).toISOString().slice(0, 10);

  for (let m = win.openMin; m <= lastStartMin; m += stepMin) {
    const startMs = baseMs + m * 60_000;
    const { segments, endMs } = buildSegments({ startMs, services: ordered as any, barberId } as any);

    // GRACE: sadece bugün için, slot başladıktan sonra 20 dk boyunca göster
    if (date === todayTR) {
      const GRACE_MIN = 20;
      const cutoff = startMs + GRACE_MIN * 60_000;
      if (Date.now() > cutoff) continue;
    }



    let ok = true;

    for (const seg of segments as any[]) {
      if (seg.resource === "hair") {
        if (hairBusy.some((b: { s: number; e: number }) => overlaps(seg.startMs, seg.endMs, b.s, b.e))) { ok = false; break; }
      } else if (seg.resource === "niyazi") {
        const c = niyaziBusy.filter((b: { s: number; e: number }) => overlaps(seg.startMs, seg.endMs, b.s, b.e)).length;
        if (c >= niyaziCapacity) { ok = false; break; }
      } else {
        // external kapasite = 1
        const c = externalBusy.filter((b: { s: number; e: number }) => overlaps(seg.startMs, seg.endMs, b.s, b.e)).length;
        if (c >= 1) { ok = false; break; }
      }
    }

    if (ok) slots.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
  }

  return NextResponse.json({ slots }, { headers: { "Cache-Control": "no-store" } });
}
