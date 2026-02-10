import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: Request) {
  const cookieStore = await cookies();
  if (cookieStore.get("admin_session")?.value !== "1") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Service role missing" }, { status: 500 });
  }

  const url = new URL(req.url);
  const daysRaw = Number(url.searchParams.get("days") || "30");
  const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(90, daysRaw)) : 30;

  const depositFilter = (url.searchParams.get("deposit") || "all").toLowerCase();

  const fromISO = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  let q = supabaseAdmin
    .from("appointments")
    .select(
      "id,customer_name,customer_phone,customer_phone_e164,customer_phone_raw,start_at,end_at,status,created_at,deposit_status,deposit_amount,total_price,cancel_reason,service_summary"
    )
    .gte("start_at", fromISO)
    .order("start_at", { ascending: true });

  if (depositFilter !== "all") {
    q = q.eq("deposit_status", depositFilter);
  }

  const apptRes = await q;

  if (apptRes.error) {
    return NextResponse.json({ error: apptRes.error.message }, { status: 400 });
  }

  const appts = (apptRes.data ?? []) as any[];
  const ids = appts.map((a) => a.id);

  const blocksBy: Record<string, any[]> = {};
  if (ids.length) {
    const segRes = await supabaseAdmin
      .from("appointment_services")
      .select("appointment_id,resource,barber_id,sort_order,start_at,end_at,status,service_id")
      .in("appointment_id", ids)
      .order("appointment_id", { ascending: true })
      .order("sort_order", { ascending: true });

    if (segRes.error) {
      return NextResponse.json({ error: segRes.error.message }, { status: 400 });
    }

    const segs = segRes.data ?? [];
    const serviceIds = Array.from(new Set(segs.map((s: any) => s.service_id).filter(Boolean)));
    const barberIds = Array.from(new Set(segs.map((s: any) => s.barber_id).filter(Boolean)));

    const [svcRes, barbRes] = await Promise.all([
      serviceIds.length
        ? supabaseAdmin.from("services").select("id,name,service_type").in("id", serviceIds)
        : Promise.resolve({ data: [], error: null } as any),
      barberIds.length
        ? supabaseAdmin.from("barbers").select("id,name").in("id", barberIds)
        : Promise.resolve({ data: [], error: null } as any),
    ]);

    if (svcRes.error) return NextResponse.json({ error: svcRes.error.message }, { status: 400 });
    if (barbRes.error) return NextResponse.json({ error: barbRes.error.message }, { status: 400 });

    const svcMap = new Map((svcRes.data ?? []).map((x: any) => [x.id, x]));
    const barbMap = new Map((barbRes.data ?? []).map((x: any) => [x.id, x]));

    for (const seg of segs as any[]) {
      if (!blocksBy[seg.appointment_id]) blocksBy[seg.appointment_id] = [];
      const svc = svcMap.get(seg.service_id);
      const barb = seg.barber_id ? barbMap.get(seg.barber_id) : null;

      blocksBy[seg.appointment_id].push({
        resource: seg.resource,
        sort_order: seg.sort_order,
        start_at: seg.start_at,
        end_at: seg.end_at,
        status: seg.status,
        service_id: seg.service_id,
        service_name: svc?.name ?? null,
        service_type: svc?.service_type ?? null,
        barber_id: seg.barber_id,
        barber_name: barb?.name ?? null,
      });
    }
  }

  
  // Lazer seçenekleri (appointment_service_options)
  const optionsBy: Record<string, any[]> = {};
  if (ids.length) {
    const optRes = await supabaseAdmin
      .from("appointment_service_options")
      .select("appointment_id, service_id, option_id, name, price, duration_min")
      .in("appointment_id", ids)
      .order("created_at", { ascending: true });

    if (optRes.error) {
      return NextResponse.json({ error: optRes.error.message }, { status: 400 });
    }

    for (const o of optRes.data ?? []) {
      if (!optionsBy[o.appointment_id]) optionsBy[o.appointment_id] = [];
      optionsBy[o.appointment_id].push(o);
    }
  }

return NextResponse.json(
    { rows: appts.map((a) => ({ ...a, blocks: blocksBy[a.id] ?? [], options: optionsBy[a.id] ?? [] })) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
