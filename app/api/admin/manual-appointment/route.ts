import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";
import { normalizePhone } from "@/lib/phone";
import { buildSegments, overlaps, sortServices, type ServiceRow, normalizeType, resourceFor, hhmmToMinute } from "@/lib/scheduling";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type DepositStatus = "pending" | "required" | "paid" | "cancelled" | "forfeited";

export async function POST(req: Request) {
  const cookieStore = await cookies();
  if (cookieStore.get("admin_session")?.value !== "1") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Service role missing" }, { status: 500 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as any;

    const customer_name = String(body.customer_name ?? "").trim();
    const customer_phone = String(body.customer_phone ?? "").trim();
    const pn = normalizePhone(customer_phone);
    if (!pn) {
      return NextResponse.json(
        { error: "Telefon formatı geçersiz. Örn: 90533xxxxxxx, 90542xxxxxxx veya +31..." },
        { status: 400 }
      );
    }

    const date = String(body.date ?? "").trim(); // YYYY-MM-DD
    const time = String(body.time ?? "").trim(); // HH:MM

    let serviceIds: string[] = [];
    if (Array.isArray(body.serviceIds)) serviceIds = body.serviceIds.map(String);
    if (Array.isArray(body.service_ids)) serviceIds = body.service_ids.map(String);
    if (serviceIds.length === 0 && body.service_id) serviceIds = [String(body.service_id)];
    serviceIds = serviceIds.map((x) => x.trim()).filter((x) => UUID_RE.test(x));

    const barberIdRaw = body.barberId ?? body.barber_id ?? null;
    const barberId = barberIdRaw && UUID_RE.test(String(barberIdRaw)) ? String(barberIdRaw) : null;

    const laser_option_ids: string[] = Array.isArray(body.laser_option_ids)
      ? body.laser_option_ids.map(String).map((x: string) => x.trim()).filter((x: string) => UUID_RE.test(x))
      : [];

    if (!customer_name) return NextResponse.json({ error: "Ad soyad zorunlu" }, { status: 400 });
    if (!date || !time) return NextResponse.json({ error: "date ve time zorunlu" }, { status: 400 });
    if (serviceIds.length === 0) return NextResponse.json({ error: "serviceIds boş" }, { status: 400 });

    const startMin = hhmmToMinute(time);
    if (!Number.isFinite(startMin)) {
      return NextResponse.json({ error: "time formatı HH:MM olmalı" }, { status: 400 });
    }

    // İstanbul +03:00
    const baseMs = Date.parse(`${date}T00:00:00+03:00`);
    if (!Number.isFinite(baseMs)) {
      return NextResponse.json({ error: "date formatı YYYY-MM-DD olmalı" }, { status: 400 });
    }
    const startMs = baseMs + startMin * 60_000;

    // Admin manuel: geçmişe yazmayı engelleyelim (istersen kaldırırız)
    if (startMs < Date.now() - 60_000) {
      return NextResponse.json({ error: "Geçmiş saate randevu girilemez" }, { status: 400 });
    }

    // Hizmetleri çek
    const svcRes = await supabaseAdmin
      .from("services")
      .select("id,name,default_duration_min,service_type,resource_group,is_active,price")
      .in("id", serviceIds);

    if (svcRes.error) return NextResponse.json({ error: svcRes.error.message }, { status: 400 });

    const services = (svcRes.data ?? []).filter((s: any) => s.is_active) as any[];
    if (services.length !== serviceIds.length) {
      return NextResponse.json({ error: "Bazı hizmetler pasif veya bulunamadı" }, { status: 400 });
    }

    const ordered = sortServices(services as any as ServiceRow[]);
    const needsHair = ordered.some((s: any) => normalizeType(s) === "hair");
    const needsNiyazi = ordered.some((s: any) => resourceFor(s as any) === "niyazi");
    const needsExternal = ordered.some((s: any) => resourceFor(s as any) === "external");

    if (needsHair && !barberId) {
      return NextResponse.json({ error: "Saç & Sakal için berber seçmelisiniz" }, { status: 400 });
    }

    const hasLaser = ordered.some((s: any) => String(s.service_type || "").toLowerCase() === "laser");
    if (hasLaser && laser_option_ids.length === 0) {
      return NextResponse.json({ error: "Lazer bölgesi seçmelisiniz" }, { status: 400 });
    }

    // Segmentleri oluştur
    const { segments, endMs } = buildSegments({ startMs, services: ordered as any, barberId });

    // Gün aralığı: overlap kontrolü için geniş tutuyoruz
    const dayStartISO = new Date(baseMs).toISOString();
    const dayEndISO = new Date(baseMs + 24 * 60 * 60_000).toISOString();

    // Niyazi kapasite: işletmeci dediğine göre 1
    const niyaziCapacity = 1;

    const [hairBusyRes, niyaziBusyRes, externalBusyRes] = await Promise.all([
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
    ]);

    if (hairBusyRes.error) return NextResponse.json({ error: hairBusyRes.error.message }, { status: 400 });
    if (niyaziBusyRes.error) return NextResponse.json({ error: niyaziBusyRes.error.message }, { status: 400 });
    if (externalBusyRes.error) return NextResponse.json({ error: externalBusyRes.error.message }, { status: 400 });

    const hairBusy: Array<{ s: number; e: number }> = (hairBusyRes.data ?? []).map((a: any) => ({ s: Date.parse(a.start_at), e: Date.parse(a.end_at) }));
    const niyaziBusy: Array<{ s: number; e: number }> = (niyaziBusyRes.data ?? []).map((a: any) => ({ s: Date.parse(a.start_at), e: Date.parse(a.end_at) }));
    const externalBusy: Array<{ s: number; e: number }> = (externalBusyRes.data ?? []).map((a: any) => ({ s: Date.parse(a.start_at), e: Date.parse(a.end_at) }));

    for (const seg of segments as any[]) {
      if (seg.resource === "hair") {
        const anyOverlap = hairBusy.some((b) => overlaps(seg.startMs, seg.endMs, b.s, b.e));
        if (anyOverlap) return NextResponse.json({ error: "Seçilen saat dolu (berber meşgul)" }, { status: 400 });
      } else if (seg.resource === "niyazi") {
        const count = niyaziBusy.filter((b) => overlaps(seg.startMs, seg.endMs, b.s, b.e)).length;
        if (count >= niyaziCapacity) return NextResponse.json({ error: "Seçilen saat dolu (Niyazi meşgul)" }, { status: 400 });
      } else {
        const count = externalBusy.filter((b) => overlaps(seg.startMs, seg.endMs, b.s, b.e)).length;
        if (count >= 1) return NextResponse.json({ error: "Seçilen saat dolu" }, { status: 400 });
      }
    }

    // total_price hesapla
    let total_price = 0;
    for (const sv of ordered as any[]) {
      const t = String(sv.service_type || "").toLowerCase();
      if (t !== "laser") total_price += Number(sv.price || 0);
    }

    let laserText = "";
    if (laser_option_ids.length > 0) {
      const optRes = await supabaseAdmin
        .from("service_options")
        .select("id, service_id, name, price, duration_min")
        .in("id", laser_option_ids);

      if (optRes.error) return NextResponse.json({ error: optRes.error.message }, { status: 400 });

      const opts = optRes.data ?? [];
      total_price += opts.reduce((sum: number, o: any) => sum + Number(o.price || 0), 0);
      laserText = opts.map((o: any) => String(o.name)).join(" + ");
    }

    const startISO = new Date(startMs).toISOString();
    const endISO = new Date(endMs).toISOString();

    const baseSummary = ordered.map((s: any) => s.name).join(" + ");
    const service_summary = laserText ? `${baseSummary} | Lazer: ${laserText}` : baseSummary;

    // Admin manuel deposit
    const deposit_status_raw = String(body.deposit_status ?? "").trim().toLowerCase();
    const deposit_status: DepositStatus =
      deposit_status_raw === "paid" || deposit_status_raw === "required" || deposit_status_raw === "pending" || deposit_status_raw === "cancelled" || deposit_status_raw === "forfeited"
        ? (deposit_status_raw as DepositStatus)
        : "pending";

    const deposit_amount = Number(body.deposit_amount ?? 0);
    const safe_deposit_amount = Number.isFinite(deposit_amount) && deposit_amount >= 0 ? Math.round(deposit_amount) : 0;

    // 1) appointments insert
    const ins = await supabaseAdmin
      .from("appointments")
      .insert([{
        service_id: String(ordered[0].id),
        barber_id: needsHair ? barberId : null,
        customer_name,
        customer_phone: pn.e164,
        customer_phone_raw: pn.raw,
        customer_phone_e164: pn.e164,
        start_at: startISO,
        end_at: endISO,
        status: "booked",
        booking_time: new Date().toISOString(),
        deposit_status,
        deposit_amount: safe_deposit_amount,
        total_price,
        service_summary: `MANUAL • ${service_summary}`,
        reminder_sent: false,
      }])
      .select("id, deposit_status, deposit_amount, total_price")
      .single();

    if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 400 });

    const appointment_id = String(ins.data.id);

    // 2) appointment_services insert
    const segRows = (segments as any[]).map((seg) => ({
      appointment_id,
      service_id: String(seg.service_id),
      resource: String(seg.resource),
      barber_id: seg.barber_id ? String(seg.barber_id) : null,
      sort_order: Number(seg.sort_order),
      start_at: new Date(seg.startMs).toISOString(),
      end_at: new Date(seg.endMs).toISOString(),
      status: "booked",
    }));

    const segIns: any = await supabaseAdmin.from("appointment_services").insert(segRows);
if (segIns.error) {
      const code = (segIns.error as any)?.code;
      // Unique violation (DB constraint) -> slot already taken
      if (code === "23505") {
        return NextResponse.json({ error: "Bu saat artık dolu." }, { status: 409 });
      }
      return NextResponse.json({ error: segIns.error.message }, { status: 400 });
    }
    if (segIns.error) {
      const msg = segIns.error.message || "";
      const isOverlap =
        msg.includes("no_overlap_hair_per_barber") ||
        msg.includes("no_overlap_niyazi") ||
        msg.includes("no_overlap_external");

      await supabaseAdmin
        .from("appointments")
        .update({ status: "cancelled", cancel_reason: isOverlap ? "slot_taken" : "server_error" })
        .eq("id", appointment_id);

      if (isOverlap) {
        return NextResponse.json({ error: "Bu saat artık dolu."}, { status: 409 });
      }
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    // 3) appointment_service_options insert (lazer)
    if (laser_option_ids.length > 0) {
      const optRes2 = await supabaseAdmin
        .from("service_options")
        .select("id, service_id, name, price, duration_min")
        .in("id", laser_option_ids);

      if (!optRes2.error) {
        const rows = (optRes2.data ?? []).map((o: any) => ({
          appointment_id,
          service_id: String(o.service_id),
          option_id: String(o.id),
          name: String(o.name),
          price: Number(o.price || 0),
          duration_min: Number(o.duration_min || 0),
        }));
        if (rows.length) await supabaseAdmin.from("appointment_service_options").insert(rows);
      }
    }

    return NextResponse.json(
      { ok: true, id: appointment_id, deposit_status, deposit_amount: safe_deposit_amount, total_price },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
