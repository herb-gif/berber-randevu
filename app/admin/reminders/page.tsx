"use client";

import { useEffect, useMemo, useState } from "react";
import AdminNavTabs from "../ui/AdminNavTabs";

type Row = {
  id: string;
  customer_name: string;
  phone: string;
  start_at: string;
  service_summary: string | null;
  reminder_sent: boolean;
  msg: string;
  wa: string;
};

const TZ = "Europe/Istanbul";
const dtf = new Intl.DateTimeFormat("tr-TR", { timeZone: TZ, dateStyle: "short", timeStyle: "short" });

function fmtDT(iso: string) {
  try { return dtf.format(new Date(iso)); } catch { return iso; }
}

export default function AdminRemindersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [daysAhead, setDaysAhead] = useState(1);
  const [includeSent, setIncludeSent] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      q.set("daysAhead", String(daysAhead));
      if (includeSent) q.set("includeSent", "1");

      const res = await fetch(`/api/admin/reminders?${q.toString()}`, { credentials: "include", cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        window.location.href = "/admin";
        return;
      }
      if (!res.ok) {
        setToast(data.error || "Hatırlatmalar alınamadı");
        return;
      }
      setRows(data.rows ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [daysAhead, includeSent]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  async function markSent(id: string, sent: boolean) {
    const res = await fetch("/api/admin/reminders", { credentials: "include", cache: "no-store", method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, sent }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setToast(data.error || "Güncellenemedi");
    setToast(sent ? "Gönderildi işaretlendi ✓" : "Geri alındı");
    await load();
  }

  const title = useMemo(() => {
    if (daysAhead === 0) return "Bugünkü hatırlatmalar";
    if (daysAhead === 1) return "Yarınki hatırlatmalar";
    return `${daysAhead} gün sonraki hatırlatmalar`;
  }, [daysAhead]);

  return (
    <main className="min-h-screen bg-neutral-50 p-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-heading text-mc-bronze">Hatırlatma Otomasyonu</h1>
          <AdminNavTabs />
          <a className="rounded-xl border border-mc-border bg-white px-4 py-2 text-sm text-mc-dark hover:border-mc-bronze transition" href="/admin">
            Admin Panel
          </a>
        </div>

        {toast && (
          <div className="rounded-xl border border-mc-bronze/30 bg-[rgba(192,138,90,0.10)] px-4 py-3 text-sm text-neutral-900 shadow-sm">
            {toast}
          </div>
        )}

        <div className="rounded-2xl border border-mc-border bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div>
              <div className="text-sm font-semibold text-neutral-900">{title}</div>
              <div className="text-xs text-neutral-500">WhatsApp Web ile tek tek gönder + gönderildi işaretle.</div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                className="rounded-xl border border-mc-border bg-white px-3 py-2 text-sm"
                value={daysAhead}
                onChange={(e) => setDaysAhead(Number(e.target.value))}
              >
                <option value={0}>Bugün</option>
                <option value={1}>Yarın</option>
                <option value={2}>2 gün</option>
                <option value={3}>3 gün</option>
                <option value={7}>7 gün</option>
              </select>

              <label className="inline-flex items-center gap-2 text-sm text-neutral-700 select-none">
                <input type="checkbox" checked={includeSent} onChange={(e) => setIncludeSent(e.target.checked)} />
                Gönderilenleri de göster
              </label>

              <button
                onClick={load}
                className="rounded-xl border border-mc-border bg-white px-4 py-2 text-sm text-mc-dark hover:border-mc-bronze transition"
              >
                Yenile
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {loading && (
            <div className="rounded-2xl border border-mc-border bg-white p-4 shadow-sm text-sm text-neutral-500">
              Yükleniyor…
            </div>
          )}

          {!loading && rows.length === 0 && (
            <div className="rounded-2xl border border-mc-border bg-white p-4 shadow-sm text-sm text-neutral-600">
              Gönderilecek hatırlatma bulunamadı.
            </div>
          )}

          {!loading && rows.map((r) => (
            <div key={r.id} className="rounded-2xl border border-mc-border bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-neutral-900">{r.customer_name}</div>
                  <div className="text-xs text-neutral-500">{r.phone}</div>
                  <div className="mt-1 text-sm">{fmtDT(r.start_at)}</div>
                  <div className="mt-1 text-xs text-neutral-600">{r.service_summary ?? "—"}</div>
                  {r.reminder_sent && (
                    <div className="mt-2 inline-flex items-center rounded-full border px-2 py-1 text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                      Gönderildi
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <a
                    className="rounded-xl bg-mc-black px-4 py-2 text-sm text-mc-bronze border border-mc-bronze hover:bg-mc-bronze hover:text-black transition"
                    href={r.wa}
                    target="_blank"
                    rel="noreferrer"
                  >
                    WhatsApp Aç
                  </a>

                  <button
                    className="rounded-xl border border-mc-border bg-white px-4 py-2 text-sm text-mc-dark hover:border-mc-bronze transition"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(r.msg);
                        setToast("Mesaj kopyalandı ✅");
                      } catch {
                        setToast("Kopyalanamadı");
                      }
                    }}
                  >
                    Kopyala
                  </button>

                  {!r.reminder_sent ? (
                    <button
                      className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700 hover:border-emerald-400 transition"
                      onClick={() => markSent(r.id, true)}
                    >
                      Gönderildi
                    </button>
                  ) : (
                    <button
                      className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2 text-sm text-neutral-700 hover:border-neutral-400 transition"
                      onClick={() => markSent(r.id, false)}
                    >
                      Geri Al
                    </button>
                  )}
                </div>
              </div>

              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-neutral-700">Mesaj önizleme</summary>
                <pre className="mt-2 whitespace-pre-wrap rounded-xl border bg-neutral-50 p-3 text-xs text-neutral-800">{r.msg}</pre>
              </details>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
