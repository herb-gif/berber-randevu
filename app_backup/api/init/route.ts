import { NextResponse } from "next/server";
import { supabase } from "../../lib/supabase";

export async function GET() {
  const [servicesRes, barbersRes] = await Promise.all([
    supabase
      .from("services")
      .select("id,name,default_duration_min,is_variable_duration,min_duration_min,max_duration_min,is_active")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("barbers")
      .select("id,name,is_active")
      .eq("is_active", true)
      .order("created_at"),
  ]);

  if (servicesRes.error) {
    return NextResponse.json({ error: servicesRes.error.message }, { status: 500 });
  }
  if (barbersRes.error) {
    return NextResponse.json({ error: barbersRes.error.message }, { status: 500 });
  }

  return NextResponse.json({
    services: servicesRes.data ?? [],
    barbers: barbersRes.data ?? [],
  });
}
