"use client";

import React, { useEffect, useMemo, useState } from "react";

type Block = {
  resource: "hair" | "niyazi" | "external" | string;
  sort_order: number;
  start_at: string;
  end_at: string;
  status: string;
  service_id: string;
  service_name: string | null;
  service_type: string | null;
  barber_id: string | null;
  barber_name: string | null;
};

type Row = {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_phone_e164?: string | null;
  customer_phone_raw?: string | null;
  start_at: string;
  end_at: string;
  status: string;
  created_at: string;
  deposit_status?: string | null;
  deposit_amount?: number | null;
  total_price?: number | null;
  cancel_reason?: string | null;
  service_summary?: string | null;
  blocks: Block[];
};

type Payment = {
  bank_name: string;
  iban: string;
  account_name?: string | null;
  note?: string | null;
  whatsapp_phone_e164?: string | null;
};

const TZ = "Europe/Istanbul";
const dtf = new Intl.DateTimeFormat("tr-TR", { timeZone: TZ, dateStyle: "short", timeStyle: "short" });
const tf = new Intl.DateTimeFormat("tr-TR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

function fmtDT(iso: string) {
  try { return dtf.format(new Date(iso)); } catch { return iso; }
}
function fmtT(iso: string) {
  try { return tf.format(new Date(iso)); } catch { return iso; }
}
function digitsOnly(x: string) {
  return (x || "").replace(/[^0-9]/g, "");
}
function waUrl(phone: string, text: string) {
  const d = digitsOnly(phone);
  const msg = encodeURIComponent(text);
  if (d.length >= 10) return `https://wa.me/${d}?text=${msg}`;
  return `https://wa.me/?text=${msg}`;
}

function depLabel(s?: string | null) {
  const v = (s || "").toLowerCase();
  if (v === "paid") return "Ödendi";
  if (v === "pending") return "Bekliyor";
  if (v === "required") return "Zorunlu";
  if (v === "forfeited") return "Yandı";
  if (v === "cancelled") return "İptal";
  return s ?? "—";
}
function depBadgeClass(s?: string | null) {
  const v = (s || "").toLowerCase();
  if (v === "paid") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (v === "forfeited") return "bg-rose-50 text-rose-700 border-rose-200";
  if (v === "required") return "bg-amber-50 text-amber-800 border-amber-200";
  if (v === "pending") return "bg-neutral-50 text-neutral-700 border-neutral-200";
  if (v === "cancelled") return "bg-neutral-100 text-neutral-600 border-neutral-200";
  return "bg-neutral-50 text-neutral-700 border-neutral-200";
}
function cancelReasonLabel(r?: string | null) {
  if (!r) return null;
  if (r === "admin") return "🔴 Admin iptal";
  if (r === "auto_no_deposit") return "🟠 Otomatik iptal (depozito yok)";
  if (r === "customer") return "⚪ Müşteri iptal";
  if (r === "unknown") return "⚫ İptal";
  return `⚫ ${r}`;
}

async function fetchPayment(): Promise<Payment | null> {
  const res = await fetch("/api/admin/payment", { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return null;
  return data.payment ?? null;
}

function buildPaymentMsg(r: Row, p: Payment) {
  const dep = r.deposit_amount ?? "";
  const when = fmtDT(r.start_at);
  const svc = r.service_summary || "—";
  const acc = p.account_name ? `Alıcı: ${p.account_name}\n` : "";

  return (
    `Merhaba ${r.customer_name},\n\n` +
    `Randevunuz oluşturuldu. Depozito bilgileri aşağıdadır:\n\n` +
    `🕒 ${when}\n` +
    `🧾 ${svc}\n` +
    `💳 Depozito: ${dep} TL\n\n` +
    `${p.bank_name}\n` +
    `${p.iban}\n` +
    acc +
    `Açıklama: Randevu - ${r.customer_name} - ${when}\n\n` +
    `📎 Ödeme dekontunu bu WhatsApp üzerinden iletebilir misiniz?\n` +
    `✅ Ödeme onayı admin tarafından verilecektir.`
  );
}

function minutesBetween(a: string, b: string) {
  const x = Date.parse(a);
  const y = Date.parse(b);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return 0;
  return Math.max(0, Math.round((y - x) / 60000));
}

export default function AdminDashboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/admin/appointments?days=${days}`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoading(false);
      alert(data.error || "Randevular alınamadı");
      return;
    }
    setRows(data.rows ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [days]);

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
    return copy;
  }, [rows]);

  async function cancel(id: string) {
    if (!confirm("Randevu iptal edilsin mi?")) return;
    const res = await fetch(`/api/admin/cancel?id=${encodeURIComponent(id)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return alert(data.error || "İptal edilemedi");
    await load();
  }

  async function markPaid(id: string) {
    const res = await fetch(`/api/admin/deposit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "paid" }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return alert(data.error || "Depozito güncellenemedi");
    await load();
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    location.reload();
  }

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Admin Panel</h1>
          <div className="text-sm text-neutral-600">Randevular + depozito + WhatsApp mesaj</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select className="rounded-xl border border-mc-border bg-white px-4 py-2 text-sm text-mc-dark hover:border-mc-bronze transition" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={1}>1 gün</option>
            <option value={7}>7 gün</option>
            <option value={14}>14 gün</option>
            <option value={30}>30 gün</option>
            <option value={60}>60 gün</option>
          </select>

          <button onClick={load} className="rounded-xl border border-mc-border bg-white px-4 py-2 text-sm text-mc-dark hover:border-mc-bronze transition">Yenile</button>
          <button onClick={logout} className="rounded-lg bg-black px-3 py-2 text-white">Çıkış</button>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-neutral-600">
            <tr>
              <th className="p-3">Zaman</th>
              <th className="p-3">Müşteri</th>
              <th className="p-3">Hizmet</th>
              <th className="p-3">Depozito</th>
              <th className="p-3">İşlem</th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr><td className="p-3 text-neutral-500" colSpan={5}>Yükleniyor…</td></tr>
            )}

            {!loading && sortedRows.length === 0 && (
              <tr><td className="p-3 text-neutral-500" colSpan={5}>Kayıt yok.</td></tr>
            )}

            {sortedRows.map((r) => {
              const reason = cancelReasonLabel(r.cancel_reason ?? null);
              const totalMin = minutesBetween(r.start_at, r.end_at);

              return (
                <React.Fragment key={r.id}>
                  <tr className="border-t align-top">
                    <td className="p-3">
                      <div className="font-medium">{fmtDT(r.start_at)}</div>
                      <div className="text-xs text-neutral-500">{fmtDT(r.end_at)} • {totalMin} dk</div>
                    </td>

                    <td className="p-3">
                      <div className="font-medium">{r.customer_name}</div>
                      <div className="text-xs text-neutral-500">
                        {r.customer_phone_e164 || r.customer_phone}
                      </div>
                      <div className="mt-1 text-xs text-neutral-500">
                        Durum: <span className="font-medium">{r.status}</span>
                      </div>
                      {r.status === "cancelled" && reason && (
                        <div className="mt-1 text-xs">
                          <span className="rounded-full border px-2 py-0.5 bg-neutral-50">{reason}</span>
                        </div>
                      )}
                    </td>

                    <td className="p-3">
                      <div className="font-medium">{r.service_summary ?? "—"}</div>
                      {typeof r.total_price === "number" && (
                        <div className="mt-1 text-xs text-neutral-500">Toplam: {r.total_price} TL</div>
                      )}
                    </td>

                    <td className="p-3">
                      <div className={`inline-flex items-center rounded-full border px-2 py-1 text-xs ${depBadgeClass(r.deposit_status ?? null)}`}>
                        {depLabel(r.deposit_status ?? null)}
                      </div>
                      {typeof r.deposit_amount === "number" && (
                        <div className="mt-1 text-xs text-neutral-500">Tutar: {r.deposit_amount} TL</div>
                      )}
                    </td>

                    <td className="p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          className="rounded-xl border border-mc-border bg-white px-4 py-2 text-sm text-mc-dark hover:border-mc-bronze transition"
                          onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                        >
                          {expandedId === r.id ? "Kapat" : "Detay"}
                        </button>

                        {r.status !== "cancelled" &&
  !["paid","odendi","ödendi","completed","confirmed"].includes(String(r.deposit_status || "").toLowerCase().trim()) && (
<button
                            className="rounded-xl bg-mc-black px-4 py-2 text-sm text-mc-bronze border border-mc-bronze hover:bg-mc-bronze hover:text-black transition"
                            onClick={() => markPaid(r.id)}
                          >
                            Ödeme Geldi
                          </button>
                        )}

                        <button
                          className="rounded-xl border border-mc-border bg-white px-4 py-2 text-sm text-mc-dark hover:border-mc-bronze transition"
                          onClick={async () => {
                            const pmt = await fetchPayment();
                            if (!pmt) return alert("Ödeme bilgileri alınamadı");
                            const msg = buildPaymentMsg(r, pmt);
                            const phone = (r.customer_phone_e164 || r.customer_phone || "");
                            window.open(waUrl(phone, msg), "_blank");
                          }}
                        >
                          Ödeme Mesajı
                        </button>

                        <button
                          className="rounded-xl border border-mc-border bg-white px-4 py-2 text-sm text-mc-dark hover:border-mc-bronze transition"
                          onClick={async () => {
                            const pmt = await fetchPayment();
                            if (!pmt) return alert("Ödeme bilgileri alınamadı");
                            const msg = buildPaymentMsg(r, pmt);
                            try {
                              await navigator.clipboard.writeText(msg);
                              alert("Mesaj kopyalandı ✅");
                            } catch {
                              alert("Kopyalanamadı");
                            }
                          }}
                        >
                          Mesajı Kopyala
                        </button>


                        {r.status !== "cancelled" && (
                          <button
                            className="rounded-xl bg-white px-4 py-2 text-sm text-rose-700 border border-rose-200 hover:border-rose-400 transition"
                            onClick={() => cancel(r.id)}
                          >
                            İptal
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {expandedId === r.id && (
                    <tr className="border-t bg-neutral-50">
                      <td className="p-3" colSpan={5}>
                        <div className="text-sm font-semibold">Bloklar</div>
                        {(r.blocks ?? []).length === 0 ? (
                          <div className="mt-2 text-sm text-neutral-600">Blok bulunamadı.</div>
                        ) : (
                          <div className="mt-3 space-y-2">
                            {(r.blocks ?? []).map((b, idx) => (
                              <div key={`${b.resource}-${b.start_at}-${idx}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-white p-2 text-sm">
                                <div className="font-medium">{b.service_name ?? "—"}</div>
                                <div className="text-neutral-700">{fmtT(b.start_at)} – {fmtT(b.end_at)}</div>
                                <div className="text-xs text-neutral-600">
                                  {b.resource === "hair" ? `Berber: ${b.barber_name ?? "—"}` : (b.resource === "external" ? "Harici" : "Niyazi")}
                                </div>
                                <div className="text-xs text-neutral-500">{b.status}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
