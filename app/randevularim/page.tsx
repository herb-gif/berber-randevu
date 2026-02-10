"use client";

import { useState } from "react";

function badge(status: string) {
  const s = (status || "").toLowerCase();
  if (s === "paid") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (s === "pending" || s === "required") return "bg-amber-50 text-amber-800 border-amber-200";
  if (s === "forfeited") return "bg-rose-50 text-rose-700 border-rose-200";
  if (s === "cancelled") return "bg-neutral-100 text-neutral-700 border-neutral-200";
  return "bg-neutral-50 text-neutral-700 border-neutral-200";
}

type Row = {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  deposit_status: string;
  deposit_amount: number;
};

function fmt(dt: string) {
  return new Date(dt).toLocaleString("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function MyAppointments() {
  const [phone, setPhone] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!phone.trim()) return alert("Telefon giriniz");
    setLoading(true);
    const res = await fetch(`/api/appointments/by-phone?phone=${encodeURIComponent(phone)}`, {
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) return alert(data.error || "Randevular alınamadı");
    setRows(data.rows ?? []);
  }

  async function cancel(id: string) {
    if (!confirm("Randevu iptal edilsin mi?")) return;
    const res = await fetch("/api/appointments/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return alert(data.error || "İptal edilemedi");
    await load();
  }

  return (
    <main className="min-h-screen bg-neutral-50 p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-2xl font-semibold">Randevularım</h1>

        <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
          <input
            className="w-full rounded-lg border px-3 py-2"
            placeholder="Telefon numaranız"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <button
            onClick={load}
            className="rounded-lg bg-black px-4 py-2 text-white"
          >
            Randevularımı Getir
          </button>
        </div>

        <div className="rounded-2xl border bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <th className="p-3 text-left">Başlangıç</th>
                <th className="p-3 text-left">Bitiş</th>
                <th className="p-3 text-left">Durum</th>
                <th className="p-3 text-left">Depozito</th>
                <th className="p-3 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3">{fmt(r.start_at)}</td>
                  <td className="p-3">{fmt(r.end_at)}</td>
                  <td className="p-3">{r.status}</td>
                  <td className="p-3"><span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs ${badge(r.deposit_status)}`}>{r.deposit_status}</span></td>
                  <td className="p-3 text-right">
                    {r.status === "booked" && (
                      <button
                        className="rounded-lg border px-3 py-2"
                        onClick={() => cancel(r.id)}
                      >
                        İptal
                      </button>
                    )}
                  </td>
                </tr>
              ))}

              {rows.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="p-6 text-neutral-500">
                    Kayıt yok.
                  </td>
                </tr>
              )}

              {loading && (
                <tr>
                  <td colSpan={5} className="p-6 text-neutral-500">
                    Yükleniyor...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
