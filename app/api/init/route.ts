import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Env overrides (prefer env over DB values)
const ENV_IBAN = process.env.MC_IBAN;
const ENV_PHONE = process.env.MC_BUSINESS_PHONE_E164;

export async function GET() {
  const [servicesRes, barbersRes, depRes, payRes] = await Promise.all([
    supabase
      .from("services")
      .select(
        "id,name,default_duration_min,is_variable_duration,min_duration_min,max_duration_min,is_active,service_type,resource_group,price"
      )
      .order("name"),
    supabase.from("barbers").select("id,name,is_active").order("name"),
    supabase
      .from("capacity_settings")
      .select("value")
      .eq("name", "deposit_amount")
      .single(),
    supabase
      .from("payment_settings")
      .select("bank_name, iban, account_name, note, whatsapp_phone_e164")
      .eq("id", 1)
      .single(),
  ]);

  if (servicesRes.error) {
    return NextResponse.json({ error: servicesRes.error.message }, { status: 400 });
  }
  if (barbersRes.error) {
    return NextResponse.json({ error: barbersRes.error.message }, { status: 400 });
  }

  const deposit_amount = depRes.data?.value ?? 300;

  const paymentBase: any = payRes.error
    ? { bank_name: "", iban: "", account_name: "", note: "", whatsapp_phone_e164: "" }
    : (payRes.data ?? {});

  // Prefer env over DB values
  const paymentOut: any = { ...paymentBase };
  if (ENV_IBAN) paymentOut.iban = ENV_IBAN;
  if (ENV_PHONE) paymentOut.whatsapp_phone_e164 = ENV_PHONE;

  return NextResponse.json(
    {
      services: servicesRes.data ?? [],
      barbers: barbersRes.data ?? [],
      deposit_amount,
      payment: paymentOut,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
