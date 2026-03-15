import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";
import { zonedDateTimeToUtcMs } from "@/lib/datetime";
import { overlaps } from "@/lib/scheduling";
import { getAdminBlockBusy } from "@/lib/adminBlocks";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    const days = Math.max(1, Math.min(30, Number(url.searchParams.get("days") || 7)));

    const fromISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const toISO = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    const res = await supabaseAdmin
      .from("admin_blocks")
      .select("id, resource, barber_id, start_at, end_at, reason, note, is_active, created_at")
      .eq("is_active", true)
      .gte("end_at", fromISO)
      .lte("start_at", toISO)
      .order("start_at", { ascending: true });

    if (res.error) {
      return NextResponse.json({ error: res.error.message }, { status: 400 });
    }

    let barberNameById: Record<string, string> = {};
    const barberIds = Array.from(
      new Set((res.data ?? []).map((x: any) => String(x.barber_id || "")).filter(Boolean))
    );

    if (barberIds.length > 0) {
      const b = await supabaseAdmin
        .from("barbers")
        .select("id,name")
        .in("id", barberIds);

      if (!b.error) {
        barberNameById = Object.fromEntries(
          (b.data ?? []).map((x: any) => [String(x.id), String(x.name)])
        );
      }
    }

    const rows = (res.data ?? []).map((r: any) => ({
      ...r,
      barber_name: r.barber_id ? barberNameById[String(r.barber_id)] || null : null,
    }));

    return NextResponse.json({ rows });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}

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

    const date = String(body.date ?? "").trim();
    const time = String(body.time ?? "").trim();
    const durationMin = Number(body.duration_min ?? 0);
    const resource = String(body.resource ?? "").trim() as "hair" | "niyazi" | "external";
    const reason = String(body.reason ?? "").trim();
    const note = String(body.note ?? "").trim();

    const barberIdRaw = body.barber_id ?? body.barberId ?? null;
    const barberId =
      barberIdRaw && UUID_RE.test(String(barberIdRaw)) ? String(barberIdRaw) : null;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "date formatı YYYY-MM-DD olmalı" }, { status: 400 });
    }
    if (!time || !/^\d{2}:\d{2}$/.test(time)) {
      return NextResponse.json({ error: "time formatı HH:MM olmalı" }, { status: 400 });
    }
    if (!["hair", "niyazi", "external"].includes(resource)) {
      return NextResponse.json({ error: "resource geçersiz" }, { status: 400 });
    }
    if (!Number.isFinite(durationMin) || durationMin <= 0) {
      return NextResponse.json({ error: "duration_min geçersiz" }, { status: 400 });
    }
    if (resource === "hair" && !barberId) {
      return NextResponse.json({ error: "Berber seçmelisiniz" }, { status: 400 });
    }

    const startMs = zonedDateTimeToUtcMs(date, time);
    const endMs = startMs + durationMin * 60_000;

    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
      return NextResponse.json({ error: "Saat aralığı geçersiz" }, { status: 400 });
    }

    const startISO = new Date(startMs).toISOString();
    const endISO = new Date(endMs).toISOString();

    const dayStartISO = new Date(zonedDateTimeToUtcMs(date, "00:00")).toISOString();
    const dayEndISO = new Date(zonedDateTimeToUtcMs(date, "23:59")).toISOString();

    const blockBusy = await getAdminBlockBusy({
      dayStartISO,
      dayEndISO,
      needsHair: resource === "hair",
      needsNiyazi: resource === "niyazi",
      needsExternal: resource === "external",
      barberId,
      useAdmin: true,
    });
    if (blockBusy.error) {
      return NextResponse.json({ error: blockBusy.error }, { status: 400 });
    }

    const apptRes = await supabaseAdmin
      .from("appointment_services")
      .select("start_at,end_at,resource,barber_id,status")
      .neq("status", "cancelled")
      .lt("start_at", dayEndISO)
      .gt("end_at", dayStartISO);

    if (apptRes.error) {
      return NextResponse.json({ error: apptRes.error.message }, { status: 400 });
    }

    const apptBusy = (apptRes.data ?? [])
      .filter((a: any) => {
        if (String(a.resource) !== resource) return false;
        if (resource === "hair") return String(a.barber_id || "") === String(barberId || "");
        return true;
      })
      .map((a: any) => ({
        s: Date.parse(a.start_at),
        e: Date.parse(a.end_at),
      }));

    const sameBlockBusy =
      resource === "hair"
        ? blockBusy.hairBusy
        : resource === "niyazi"
        ? blockBusy.niyaziBusy
        : blockBusy.externalBusy;

    const anyOverlap = [...apptBusy, ...sameBlockBusy].some((b) =>
      overlaps(startMs, endMs, b.s, b.e)
    );

    if (anyOverlap) {
      return NextResponse.json({ error: "Bu saat zaten dolu veya bloklu." }, { status: 409 });
    }

    const ins = await supabaseAdmin
      .from("admin_blocks")
      .insert([
        {
          resource,
          barber_id: resource === "hair" ? barberId : null,
          start_at: startISO,
          end_at: endISO,
          reason: reason || null,
          note: note || null,
          is_active: true,
        },
      ])
      .select("id, resource, barber_id, start_at, end_at, reason, note, is_active, created_at")
      .single();

    if (ins.error) {
      return NextResponse.json({ error: ins.error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, row: ins.data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
