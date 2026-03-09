import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";
import { sendMessage } from "@/lib/notify";
import { DISPLAY_TZ } from "@/lib/timezone";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  const cookieStore = await cookies();
  if (cookieStore.get("admin_session")?.value !== "1") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Service role missing" }, { status: 500 });
  }

  const body = (await req.json().catch(() => ({}))) as any;
  const id = String(body.id || "").trim();
  const status = String(body.status || "paid").trim();

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Geçersiz id" }, { status: 400 });
  }

  const allowed = new Set(["paid", "pending", "required", "forfeited", "cancelled"]);
  const nextStatus = allowed.has(status) ? status : "paid";

  const upd = await supabaseAdmin
    .from("appointments")
    .update({ deposit_status: nextStatus })
    .eq("id", id)
    .select("id, deposit_status, customer_name, customer_phone, start_at, service_summary")
    .single();

  if (upd.error) {
    return NextResponse.json({ error: upd.error.message }, { status: 400 });
  }

  // paid -> müşteriye bilgilendirme (şimdilik notify log)
  if (nextStatus === "paid") {
    try {
      const msg =
        `Merhaba ${upd.data.customer_name},\n\n` +
        `✅ Ödemeniz alındı. Randevunuz ONAYLANDI.\n\n` +
        `🕒 Tarih/Saat: ${new Date(upd.data.start_at).toLocaleString("tr-TR", { timeZone: DISPLAY_TZ })}\n` +
        `🧾 Hizmet: ${upd.data.service_summary || "—"}\n\n` +
        `Görüşmek üzere ✂️`;

      await sendMessage({ phone: upd.data.customer_phone, text: msg });
    } catch (e) {
      console.error("notify failed", e);
    }
  }

  return NextResponse.json(
    { ok: true, row: { id: upd.data.id, deposit_status: upd.data.deposit_status } },
    { headers: { "Cache-Control": "no-store" } }
  );
}
