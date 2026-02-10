import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: Request) {
  const isAdmin = (await cookies()).get("admin_session")?.value === "1";
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Service role missing" }, { status: 500 });
  }

  const url = new URL(req.url);
  const appointment_id = url.searchParams.get("appointment_id");
  if (!appointment_id) {
    return NextResponse.json({ error: "appointment_id gerekli" }, { status: 400 });
  }

  const segRes = await supabaseAdmin
    .from("appointment_services")
    .select("id,service_id,resource,barber_id,sort_order,start_at,end_at,status")
    .eq("appointment_id", appointment_id)
    .order("sort_order", { ascending: true });

  if (segRes.error) {
    return NextResponse.json({ error: segRes.error.message }, { status: 400 });
  }

  const segs = segRes.data ?? [];

  const serviceIds = Array.from(new Set(segs.map((s: any) => s.service_id))).filter(Boolean);
  const barberIds = Array.from(new Set(segs.map((s: any) => s.barber_id))).filter(Boolean);

  const [svcRes, barbRes] = await Promise.all([
    serviceIds.length
      ? supabaseAdmin.from("services").select("id,name").in("id", serviceIds)
      : Promise.resolve({ data: [], error: null } as any),
    barberIds.length
      ? supabaseAdmin.from("barbers").select("id,name").in("id", barberIds)
      : Promise.resolve({ data: [], error: null } as any),
  ]);

  if (svcRes.error) return NextResponse.json({ error: svcRes.error.message }, { status: 400 });
  if (barbRes.error) return NextResponse.json({ error: barbRes.error.message }, { status: 400 });

  const svcMap = new Map<number, string>((svcRes.data ?? []).map((x: any) => [x.id, x.name]));
  const barbMap = new Map<number, string>((barbRes.data ?? []).map((x: any) => [x.id, x.name]));

  const out = segs.map((s: any) => ({
    ...s,
    service_name: svcMap.get(s.service_id) ?? `#${s.service_id}`,
    barber_name: s.barber_id ? (barbMap.get(s.barber_id) ?? `#${s.barber_id}`) : null,
  }));

  return NextResponse.json({ segments: out }, { headers: { "Cache-Control": "no-store" } });
}
