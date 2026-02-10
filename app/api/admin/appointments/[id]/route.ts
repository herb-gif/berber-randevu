import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";

function extractId(req: Request, params?: { id?: string }) {
  const fromParams = params?.id?.trim();
  if (fromParams) return fromParams;

  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  return parts[parts.length - 1] || null;
}

export async function GET(req: Request, ctx: { params?: { id?: string } }) {
  const cookieStore = await cookies();
  if (cookieStore.get("admin_session")?.value !== "1") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Service role missing" }, { status: 500 });
  }

  const id = extractId(req, ctx?.params);
  if (!id) return NextResponse.json({ error: "appointment id gerekli" }, { status: 400 });

  const apptRes = await supabaseAdmin
    .from("appointments")
    .select(
      "id,customer_name,customer_phone,start_at,end_at,status,created_at,deposit_status,deposit_amount,cancel_reason,service_summary"
    )
    .eq("id", id)
    .single();

  if (apptRes.error) return NextResponse.json({ error: apptRes.error.message }, { status: 400 });

  const segRes = await supabaseAdmin
    .from("appointment_services")
    .select("appointment_id,resource,barber_id,sort_order,start_at,end_at,status,service_id")
    .eq("appointment_id", id)
    .order("sort_order", { ascending: true });

  if (segRes.error) return NextResponse.json({ error: segRes.error.message }, { status: 400 });

  return NextResponse.json(
    { ...apptRes.data, blocks: segRes.data ?? [] },
    { headers: { "Cache-Control": "no-store" } }
  );
}
