import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  // Public endpoint: only return payment instructions (no secrets)
  const { data, error } = await supabase
    .from("payment_settings")
    .select("bank_name, iban, account_name, note, whatsapp_phone_e164")
    .limit(1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const row = (data && data[0]) || null;

  return NextResponse.json(
    { ok: true, payment: row },
    { headers: { "Cache-Control": "no-store" } }
  );
}
