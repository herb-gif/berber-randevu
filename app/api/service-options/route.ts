import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const service_id = url.searchParams.get("service_id");
  if (!service_id) {
    return NextResponse.json({ error: "service_id gerekli" }, { status: 400 });
  }

  const res = await supabase
    .from("service_options")
    .select("id, service_id, name, price, duration_min, is_active, sort_order")
    .eq("service_id", service_id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (res.error) return NextResponse.json({ error: res.error.message }, { status: 400 });

  return NextResponse.json({ options: res.data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}
