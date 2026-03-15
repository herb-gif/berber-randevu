import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Env overrides (prefer env over DB values)
const ENV_IBAN = process.env.MC_IBAN;
const ENV_PHONE = process.env.MC_BUSINESS_PHONE_E164;

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

  // Prefer env over DB values
  const paymentOut: any = res.data ?? {};
  if (ENV_IBAN) paymentOut.iban = ENV_IBAN;
  if (ENV_PHONE) paymentOut.whatsapp_phone_e164 = ENV_PHONE;

  return NextResponse.json(
    { ok: true, payment: paymentOut },
    { headers: { "Cache-Control": "no-store" } }
  );
}
