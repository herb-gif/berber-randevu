import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const phone = url.searchParams.get("phone");

  if (!id || !phone) {
    return NextResponse.json({ error: "id ve phone gerekli" }, { status: 400 });
  }

  const res = await supabase
    .from("appointments")
    .select("id, status, deposit_status, deposit_amount")
    .eq("id", id)
    .eq("customer_phone", phone)
    .single();

  if (res.error) {
    return NextResponse.json({ error: "Randevu bulunamadı" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, row: res.data }, { headers: { "Cache-Control": "no-store" } });
}
