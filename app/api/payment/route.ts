import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  // Public endpoint for confirmation: payment instructions only
  const res = await supabase
    .from("payment_settings")
    .select("bank_name, iban, account_name, note, whatsapp_phone_e164")
    .eq("id", 1)
    .single();

  if (res.error) {
    return NextResponse.json({ error: res.error.message }, { status: 400 });
  }

  return NextResponse.json(
    { ok: true, payment: res.data },
    { headers: { "Cache-Control": "no-store" } }
  );
}
