import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { normalizePhone } from "@/lib/phone";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const phone = url.searchParams.get("phone");

  if (!phone) return NextResponse.json({ error: "phone gerekli" }, { status: 400 });

  const pn = normalizePhone(phone);
  if (!pn) return NextResponse.json({ error: "Telefon formatı geçersiz" }, { status: 400 });

  const res = await supabase
    .from("appointments")
    .select("id, start_at, end_at, status, deposit_status, deposit_amount, total_price")
    .eq("customer_phone_e164", pn.e164)
    .order("start_at", { ascending: true });

  if (res.error) return NextResponse.json({ error: res.error.message }, { status: 400 });

  return NextResponse.json({ rows: res.data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}
