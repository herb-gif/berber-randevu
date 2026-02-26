import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const [servicesRes, barbersRes, depRes, payRes] = await Promise.all([
    supabase
      .from("services")
      .select("id,name,default_duration_min,is_variable_duration,min_duration_min,max_duration_min,is_active,service_type,resource_group,price")
      .order("name"),
    supabase
      .from("barbers")
      .select("id,name,is_active")
      .order("name"),
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

  if (servicesRes.error) return NextResponse.json({ error: servicesRes.error.message }, { status: 400 });
  if (barbersRes.error) return NextResponse.json({ error: barbersRes.error.message }, { status: 400 });

  const deposit_amount = depRes.data?.value ?? 300;
  const payment = payRes.error
    ? { bank_name: "", iban: "", account_name: "", note: "", whatsapp_phone_e164: "" }
    : payRes.data;

  return NextResponse.json({
    services: servicesRes.data ?? [],
    barbers: barbersRes.data ?? [],
    deposit_amount,
    payment,
  });
}
