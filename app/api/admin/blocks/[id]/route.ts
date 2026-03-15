import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  if (cookieStore.get("admin_session")?.value !== "1") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Service role missing" }, { status: 500 });
  }

  try {
    const { id } = await ctx.params;
    if (!id) {
      return NextResponse.json({ error: "id gerekli" }, { status: 400 });
    }

    const upd = await supabaseAdmin
      .from("admin_blocks")
      .update({ is_active: false })
      .eq("id", id)
      .eq("is_active", true)
      .select("id")
      .single();

    if (upd.error) {
      return NextResponse.json({ error: upd.error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
