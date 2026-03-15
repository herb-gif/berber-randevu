import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";
import { getWorkWindow } from "@/lib/workHours";
import { buildSegments, overlaps, sortServices, type ServiceRow, resourceFor } from "@/lib/scheduling";
import { zonedDateTimeToUtcMs } from "@/lib/datetime";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export async function GET(req: Request) {
  const cookieStore = await cookies();
  if (cookieStore.get("admin_session")?.value !== "1") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Service role missing" }, { status: 500 });
  }

  try {
    const url = new URL(req.url);
    const date = String(url.searchParams.get("date") || "").trim();
    const serviceIdsRaw = String(
      url.searchParams.get("serviceIds") || url.searchParams.get("service_ids") || ""
    ).trim();
    const barberIdRaw = String(
      url.searchParams.get("barberId") || url.searchParams.get("barber_id") || ""
    ).trim();

    if (!date) {
      return NextResponse.json({ error: "date gerekli" }, { status: 400 });
    }
    if (!serviceIdsRaw) {
      return NextResponse.json({ error: "serviceIds gerekli" }, { status: 400 });
    }

    const serviceIds = serviceIdsRaw
      .split(",")
      .map((x) => x.trim())
      .filter((x) => UUID_RE.test(x));

    if (serviceIds.length === 0) {
      return NextResponse.json({ error: "serviceIds boş" }, { status: 400 });
    }

    const barberId = barberIdRaw && UUID_RE.test(barberIdRaw) ? barberIdRaw : null;

    const win = getWorkWindow(date);
    const baseMs = zonedDateTimeToUtcMs(date, "00:00");
    const dayStartISO = new Date(baseMs + win.openMin * 60_000).toISOString();
    const dayEndISO = new Date(zonedDateTimeToUtcMs(date, "23:59")).toISOString();

    const svc = await supabaseAdmin
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

    if (needsHair && !barberId) {
      return NextResponse.json({ error: "Berber seçmelisiniz" }, { status: 400 });
    }

    let niyaziCapacity = 1;
    if (needsNiyazi) {
      const cap = await supabaseAdmin
        .from("capacity_settings")
        .select("value")
        .eq("name", "niyazi_capacity")
        .single();
      niyaziCapacity = cap.data?.value ?? 1;
    }

    const [hairBusyRes, niyaziBusyRes, externalBusyRes, rawBlocksRes] = await Promise.all([
      needsHair
        ? supabaseAdmin
            .from("appointment_services")
            .select("start_at,end_at,status")
            .eq("resource", "hair")
            .eq("barber_id", barberId as string)
            .neq("status", "cancelled")
            .lt("start_at", dayEndISO)
            .gt("end_at", dayStartISO)
        : Promise.resolve({ data: [], error: null } as any),

      needsNiyazi
        ? supabaseAdmin
            .from("appointment_services")
            .select("start_at,end_at,status")
            .eq("resource", "niyazi")
            .neq("status", "cancelled")
            .lt("start_at", dayEndISO)
            .gt("end_at", dayStartISO)
        : Promise.resolve({ data: [], error: null } as any),

      needsExternal
        ? supabaseAdmin
            .from("appointment_services")
            .select("start_at,end_at,status")
            .eq("resource", "external")
            .neq("status", "cancelled")
            .lt("start_at", dayEndISO)
            .gt("end_at", dayStartISO)
        : Promise.resolve({ data: [], error: null } as any),

      supabaseAdmin
        .from("admin_blocks")
        .select("id,resource,barber_id,start_at,end_at,is_active")
        .eq("is_active", true)
        .lt("start_at", dayEndISO)
        .gt("end_at", dayStartISO),
    ]);

    if (hairBusyRes.error) return NextResponse.json({ error: hairBusyRes.error.message }, { status: 400 });
    if (niyaziBusyRes.error) return NextResponse.json({ error: niyaziBusyRes.error.message }, { status: 400 });
    if (externalBusyRes.error) return NextResponse.json({ error: externalBusyRes.error.message }, { status: 400 });
    if (rawBlocksRes.error) return NextResponse.json({ error: rawBlocksRes.error.message }, { status: 400 });

    const apptHairBusy = (hairBusyRes.data ?? []).map((a: any) => ({ s: Date.parse(a.start_at), e: Date.parse(a.end_at) }));
    const apptNiyaziBusy = (niyaziBusyRes.data ?? []).map((a: any) => ({ s: Date.parse(a.start_at), e: Date.parse(a.end_at) }));
    const apptExternalBusy = (externalBusyRes.data ?? []).map((a: any) => ({ s: Date.parse(a.start_at), e: Date.parse(a.end_at) }));

    const rawBlocks = (rawBlocksRes.data ?? []) as Array<{
      id: string;
      resource: string;
      barber_id: string | null;
      start_at: string;
      end_at: string;
      is_active: boolean;
    }>;

    const stepMin = 60;
    const slots: Array<{
      time: string;
      status: "available" | "booked" | "blocked" | "outside_hours";
      label: string;
      blockId?: string;
    }> = [];

    const isMixed = needsHair && (needsNiyazi || needsExternal);
    const lastStartMin = needsHair
      ? (isMixed ? win.lastStartOtherMin : win.lastStartHairMin)
      : win.lastStartOtherMin;

    for (let m = 9 * 60; m <= 21 * 60; m += stepMin) {
      const hhmm = `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

      if (m < win.openMin || m > lastStartMin) {
        slots.push({ time: hhmm, status: "outside_hours", label: "Mesai Dışı" });
        continue;
      }

      const startMs = zonedDateTimeToUtcMs(date, hhmm);
      const { segments } = buildSegments({
        startMs,
        services: ordered as any,
        barberId,
      } as any);

      let blocked = false;
      let booked = false;
      let blockId: string | undefined = undefined;

      for (const seg of segments as any[]) {
        if (seg.resource === "hair") {
          const matchedBlock = rawBlocks.find((b) =>
            String(b.resource) === "hair" &&
            String(b.barber_id || "") === String(barberId || "") &&
            overlaps(seg.startMs, seg.endMs, Date.parse(b.start_at), Date.parse(b.end_at))
          );
          if (matchedBlock) {
            blocked = true;
            blockId = String(matchedBlock.id);
            break;
          }
          if (apptHairBusy.some((b: { s: number; e: number }) => overlaps(seg.startMs, seg.endMs, b.s, b.e))) {
            booked = true;
          }
        } else if (seg.resource === "niyazi") {
          const matchedBlock = rawBlocks.find((b) =>
            String(b.resource) === "niyazi" &&
            overlaps(seg.startMs, seg.endMs, Date.parse(b.start_at), Date.parse(b.end_at))
          );
          if (matchedBlock) {
            blocked = true;
            blockId = String(matchedBlock.id);
            break;
          }
          const busyCount = apptNiyaziBusy.filter((b: { s: number; e: number }) => overlaps(seg.startMs, seg.endMs, b.s, b.e)).length;
          if (busyCount >= niyaziCapacity) {
            booked = true;
          }
        } else {
          const matchedBlock = rawBlocks.find((b) =>
            String(b.resource) === "external" &&
            overlaps(seg.startMs, seg.endMs, Date.parse(b.start_at), Date.parse(b.end_at))
          );
          if (matchedBlock) {
            blocked = true;
            blockId = String(matchedBlock.id);
            break;
          }
          if (apptExternalBusy.some((b: { s: number; e: number }) => overlaps(seg.startMs, seg.endMs, b.s, b.e))) {
            booked = true;
          }
        }
      }

      if (blocked) {
        slots.push({ time: hhmm, status: "blocked", label: "Bloklu", blockId });
      } else if (booked) {
        slots.push({ time: hhmm, status: "booked", label: "Dolu" });
      } else {
        slots.push({ time: hhmm, status: "available", label: "Müsait" });
      }
    }

    return NextResponse.json({ slots });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
