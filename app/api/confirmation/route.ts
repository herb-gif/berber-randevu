import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = String(url.searchParams.get("id") || "").trim();
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const appt = await supabase
    .from("appointments")
    .select("id, customer_name, start_at, end_at, barber_id, service_summary, total_price, deposit_amount, deposit_status, status")
    .eq("id", id)
    .single();

  if (appt.error) return NextResponse.json({ error: appt.error.message }, { status: 400 });
  if (!appt.data) return NextResponse.json({ error: "not found" }, { status: 404 });

  let barber_name: string | null = null;
  if (appt.data.barber_id) {
    const b = await supabase.from("barbers").select("name").eq("id", appt.data.barber_id).single();
    barber_name = (b.data as any)?.name ?? null;
  }

  return NextResponse.json(
    {
      ok: true,
      appointment: {
        id: appt.data.id,
        customer_name: appt.data.customer_name,
        start_at: appt.data.start_at,
        end_at: appt.data.end_at,
        barber_name,
        service_summary: appt.data.service_summary,
        total_price: appt.data.total_price,
        deposit_amount: appt.data.deposit_amount,
        deposit_status: appt.data.deposit_status,
        status: appt.data.status,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
