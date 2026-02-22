import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  
  const { id } = await params;
if (!supabaseAdmin) {
    return NextResponse.json({ error: "Service role missing" }, { status: 500 });
  }
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Geçersiz id" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const patch: any = {};

  if (typeof body?.name === "string") {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ error: "name boş olamaz" }, { status: 400 });
    patch.name = name;
  }

  if (typeof body?.is_active === "boolean") {
    patch.is_active = body.is_active;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "patch boş" }, { status: 400 });
  }

  const upd = await supabaseAdmin
    .from("barbers")
    .update(patch)
    .eq("id", id)
    .select("id,name,is_active,created_at")
    .single();

  if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 400 });
  return NextResponse.json({ row: upd.data }, { headers: { "Cache-Control": "no-store" } });
}

// Soft delete: is_active=false
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Service role missing" }, { status: 500 });
  }
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Geçersiz id" }, { status: 400 });

  const upd = await supabaseAdmin
    .from("barbers")
    .update({ is_active: false })
    .eq("id", id)
    .select("id,name,is_active,created_at")
    .single();

  if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 400 });
  return NextResponse.json({ row: upd.data }, { headers: { "Cache-Control": "no-store" } });
}

