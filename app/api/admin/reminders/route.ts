import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";
import { buildReminderMessage, buildWhatsAppWebUrl } from "@/lib/whatsapp";

const TZ = "Europe/Istanbul";

function trPartsFromISO(iso: string) {
  const parts = new Intl.DateTimeFormat("tr-TR", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));

  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  const yyyy = get("year");
  const mm = get("month");
  const dd = get("day");
  const hh = get("hour");
  const mi = get("minute");

  return {
    dateISO: `${yyyy}-${mm}-${dd}`,
    timeHHMM: `${hh}:${mi}`,
  };
}

// TR "bugün" (YYYY-MM-DD)
function todayTRISO() {
  return new Date(Date.now() + 3 * 60 * 60_000).toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const cookieStore = await cookies();
  if (cookieStore.get("admin_session")?.value !== "1") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Service role missing" }, { status: 500 });
  }

  const url = new URL(req.url);
  const daysAhead = Math.max(0, Math.min(7, Number(url.searchParams.get("daysAhead") || "1"))); // default: yarın
  const includeSent = String(url.searchParams.get("includeSent") || "").toLowerCase() === "1";

  const base = new Date(`${todayTRISO()}T00:00:00+03:00`);
  base.setDate(base.getDate() + daysAhead);

  const startLocal = base; // 00:00 TR
  const endLocal = new Date(base.getTime() + 24 * 60 * 60_000);

  const startISO = startLocal.toISOString();
  const endISO = endLocal.toISOString();

  let q = supabaseAdmin
    .from("appointments")
    .select("id, customer_name, customer_phone, customer_phone_e164, start_at, status, service_summary, reminder_sent")
    .gte("start_at", startISO)
    .lt("start_at", endISO)
    .neq("status", "cancelled")
    .order("start_at", { ascending: true });

  if (!includeSent) q = q.eq("reminder_sent", false);

  const res = await q;
  if (res.error) return NextResponse.json({ error: res.error.message }, { status: 400 });

  const rows = (res.data ?? []).map((r: any) => {
    const phone = String(r.customer_phone_e164 || r.customer_phone || "").trim();
    const { dateISO, timeHHMM } = trPartsFromISO(r.start_at);
    const msg = buildReminderMessage({
      customerName: String(r.customer_name || "").trim() || "Müşteri",
      date: dateISO,
      time: timeHHMM,
      serviceSummary: String(r.service_summary || "—"),
    });
    const wa = buildWhatsAppWebUrl(phone, msg);

    return {
      id: String(r.id),
      customer_name: r.customer_name,
      phone,
      start_at: r.start_at,
      service_summary: r.service_summary,
      reminder_sent: !!r.reminder_sent,
      msg,
      wa,
    };
  });

  return NextResponse.json({ ok: true, rows }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  if (cookieStore.get("admin_session")?.value !== "1") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Service role missing" }, { status: 500 });
  }

  const body = (await req.json().catch(() => ({}))) as any;
  const id = String(body.id || "").trim();
  const sent = Boolean(body.sent ?? true);

  if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });

  const upd = await supabaseAdmin
    .from("appointments")
    .update({ reminder_sent: sent })
    .eq("id", id)
    .select("id, reminder_sent")
    .single();

  if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 400 });
  return NextResponse.json({ ok: true, row: upd.data }, { headers: { "Cache-Control": "no-store" } });
}
