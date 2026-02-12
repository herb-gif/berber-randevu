import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request) {
  const isAdmin = (await cookies()).get("admin_session")?.value === "1";
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });

  
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Admin bağlantısı yok (supabaseAdmin)" }, { status: 500 });
  }

const upd = await supabaseAdmin
    .from("appointments")
    .update({ deposit_status: "paid" })
    .eq("id", id);

  if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
