import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "../../../lib/supabase";

export async function POST(req: Request) {
  const isAdmin = cookies().get("admin_session")?.value === "1";
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const upd = await supabase.from("appointments").update({ status: "cancelled" }).eq("id", id);
  if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 500 });

  // form submit redirect back
  return NextResponse.redirect(new URL("/admin", req.url));
}
