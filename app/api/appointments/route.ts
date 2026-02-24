import { NextResponse } from "next/server";
import { normalizePhone } from "@/lib/phone";
import { getWorkWindow } from "@/lib/workHours";
import { supabase } from "@/lib/supabase";
import { buildSegments, overlaps, sortServices, type ServiceRow, normalizeType, resourceFor, hhmmToMinute } from "@/lib/scheduling";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as any;

    const customer_name = String(body.customer_name ?? "").trim();
    const customer_phone = String(body.customer_phone ?? "").trim();

    const pn = normalizePhone(customer_phone);
    if (!pn) {
      return NextResponse.json({ error: "Telefon formatı geçersiz. Örn: 90533xxxxxxx, 90542xxxxxxx veya +31..." }, { status: 400 });
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

    if (!customer_name || !customer_phone) {
      return NextResponse.json({ error: "Ad soyad ve telefon zorunlu" }, { status: 400 });
    }
    if (!date || !time) {
      return NextResponse.json({ error: "date ve time zorunlu" }, { status: 400 });
    }
    if (serviceIds.length === 0) {
      return NextResponse.json({ error: "serviceIds boş" }, { status: 400 });
    }

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

      /* GRACE_GUARD: slot başladıktan sonra 20 dk tolerans */
    {
      const GRACE_MIN = 20;
      const cutoff = startMs + GRACE_MIN * 60_000;
      if (Date.now() > cutoff) {
        return NextResponse.json(
          { error: "Bu saat artık geçti. Lütfen yeni bir saat seçin." },
          { status: 400 }
        );
      }
    }

    // ✅ Çalışma saatleri kuralı (Perşembe özel)
    const win = getWorkWindow(date);
    if (startMin < win.openMin) {
          }


    // Hizmetleri çek
    const svcRes = await supabase
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

    const isMixed = needsHair && (needsNiyazi || needsExternal);

    // Hair-only kuralı: müşteri hair cutoff sonrası alamaz
    if (needsHair && !isMixed && startMin > win.lastStartHairMin) {
      return NextResponse.json({ error: "Berber için bu saatten sonra randevu alınamaz." }, { status: 400 });
    }


    if (needsHair && !barberId) {
      return NextResponse.json({ error: "Saç & Sakal için berber seçmelisiniz" }, { status: 400 });
    }

    // Lazer seçildiyse option zorunlu
    const hasLaser = ordered.some((s: any) => String(s.service_type || "").toLowerCase() === "laser");
    if (hasLaser && laser_option_ids.length === 0) {
      return NextResponse.json({ error: "Lazer bölgesi seçmelisiniz" }, { status: 400 });
    }

    // Segmentleri oluştur (ardışık)
    const { segments, endMs } = buildSegments({ startMs, services: ordered as any, barberId });

    const dayStartISO = new Date(baseMs + win.openMin * 60_000).toISOString();
    const dayEndISO = new Date(baseMs + 24 * 60 * 60_000).toISOString();

    // Niyazi kapasite
    let niyaziCapacity = 1;
    if (needsNiyazi) {
      const cap = await supabase
        .from("capacity_settings")
        .select("value")
        .eq("name", "niyazi_capacity")
        .single();
      niyaziCapacity = cap.data?.value ?? 1;
      if (niyaziCapacity <= 0) {
        return NextResponse.json({ error: "Niyazi kapasitesi 0" }, { status: 400 });
      }
    }

    // Busy blokları
    const [hairBusyRes, niyaziBusyRes] = await Promise.all([
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
    ]);

    if (hairBusyRes.error) return NextResponse.json({ error: hairBusyRes.error.message }, { status: 400 });
    if (niyaziBusyRes.error) return NextResponse.json({ error: niyaziBusyRes.error.message }, { status: 400 });

    const hairBusy = (hairBusyRes.data ?? []).map((a: any) => ({ s: Date.parse(a.start_at), e: Date.parse(a.end_at) }));
    const niyaziBusy = (niyaziBusyRes.data ?? []).map((a: any) => ({ s: Date.parse(a.start_at), e: Date.parse(a.end_at) }));

    for (const seg of segments as any[]) {
      if (seg.resource === "hair") {
        const anyOverlap = hairBusy.some((b: { s: number; e: number }) => overlaps(seg.startMs, seg.endMs, b.s, b.e));
        if (anyOverlap) return NextResponse.json({ error: "Seçilen saat dolu (berber meşgul)" }, { status: 400 });
      } else {
        const count = niyaziBusy.filter((b: { s: number; e: number }) => overlaps(seg.startMs, seg.endMs, b.s, b.e)).length;
        if (count >= niyaziCapacity) return NextResponse.json({ error: "Seçilen saat dolu (Niyazi meşgul)" }, { status: 400 });
      }
    }

    // Depozito yüzdesi
    const depPctRes = await supabase
      .from("capacity_settings")
      .select("value")
      .eq("name", "deposit_percent")
      .single();
    const depositPercent = Number(depPctRes.data?.value ?? 20);

    const minDepRes = await supabase
      .from("capacity_settings")
      .select("value")
      .eq("name", "min_deposit_amount")
      .single();
    const minDepositAmount = Number(minDepRes.data?.value ?? 0);


    // total_price: şimdilik lazer option toplamı (diğer hizmet fiyatları sonra)
    let total_price = 0;
    // service prices (hair/facial/brow). Laser price comes from options.
    for (const sv of ordered as any[]) {
      const t = String(sv.service_type || "").toLowerCase();
      if (t !== "laser") total_price += Number(sv.price || 0);
    }

    let laserText = "";

    if (laser_option_ids.length > 0) {
      const optRes = await supabase
        .from("service_options")
        .select("id, service_id, name, price, duration_min")
        .in("id", laser_option_ids);

      if (optRes.error) return NextResponse.json({ error: optRes.error.message }, { status: 400 });

      const opts = optRes.data ?? [];
      total_price += opts.reduce((sum: number, o: any) => sum + Number(o.price || 0), 0);
      laserText = opts.map((o: any) => String(o.name)).join(" + ");
    }

    const computedDeposit = Math.max(0, Math.round((total_price * depositPercent) / 100));
    const deposit_amount = Math.max(computedDeposit, Math.max(0, Math.floor(minDepositAmount)));

    // Depozito status (2 saat kuralı): 2 saatten az kala => required
    const diffMin = Math.floor((startMs - Date.now()) / 60_000);
    const deposit_status = diffMin < 120 ? "required" : "pending";

    const startISO = new Date(startMs).toISOString();
    const endISO = new Date(endMs).toISOString();

    const baseSummary = ordered.map((s: any) => s.name).join(" + ");
    const service_summary = laserText ? `${baseSummary} | Lazer: ${laserText}` : baseSummary;

    // Mixed ve hair cutoff sonrası => admin onayına bırak
    const lateHairNeedsApproval = isMixed && needsHair && startMin > win.lastStartHairMin;
    const final_service_summary = lateHairNeedsApproval ? `⚠️ Admin Onay: ` : service_summary;

    // 1) appointments insert
    const ins = await supabase
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
        deposit_amount,
        total_price,
        service_summary: final_service_summary,
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

    const segIns: any = await supabase.from("appointment_services").insert(segRows);
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

      await supabase
        .from("appointments")
        .update({ status: "cancelled", cancel_reason: isOverlap ? "slot_taken" : "server_error" })
        .eq("id", appointment_id);

      if (isOverlap) {
        return NextResponse.json(
          { error: "Seçilen saat az önce doldu. Lütfen başka bir saat seçin." },
          { status: 400 }
        );
      }

      return NextResponse.json({ error: msg }, { status: 400 });
    }

    // 3) appointment_service_options insert (lazer)
    if (laser_option_ids.length > 0) {
      const optRes2 = await supabase
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
        if (rows.length) await supabase.from("appointment_service_options").insert(rows);
      }
    }

    return NextResponse.json(
      { ok: true, id: appointment_id, deposit_status, deposit_amount, total_price },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
