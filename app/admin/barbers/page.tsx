"use client";

import { useEffect, useMemo, useState } from "react";
import AdminNavTabs from "../ui/AdminNavTabs";

type Barber = {
  id: string;
  name: string | null;
  is_active: boolean | null;
  created_at?: string | null;
};

export default function AdminBarbersPage() {
  const [items, setItems] = useState<Barber[]>([]);
  const [name, setName] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/barbers", { cache: "no-store", credentials: "include" });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.error || "Load failed");
      setItems(Array.isArray(j?.barbers) ? j.barbers : []);
    } catch (e: any) {
      setToast(e?.message || "Yükleme hatası");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addBarber() {
    const v = name.trim();
    if (!v) return setToast("İsim gir");
    try {
      const r = await fetch("/api/admin/barbers", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: v }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.error || "Ekleme başarısız");
      setName("");
      setToast("Kaydedildi");
      await load();
    } catch (e: any) {
      setToast(e?.message || "Ekleme hatası");
    }
  }

  async function toggleActive(id: string, next: boolean) {
    try {
      const r = await fetch("/api/admin/barbers", {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, is_active: next }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.error || "Güncelleme başarısız");
      setToast(next ? "Aktif edildi" : "Pasif edildi");
      setItems((prev) => prev.map((b) => (b.id === id ? { ...b, is_active: next } : b)));
    } catch (e: any) {
      setToast(e?.message || "Güncelleme hatası");
    }
  }

  const activeCount = useMemo(() => items.filter((x) => x.is_active).length, [items]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <AdminNavTabs />

      <div className="mt-6 rounded-2xl border border-white/10 bg-neutral-950 p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-white">Berberler</div>
            <div className="mt-1 text-sm text-white/60">
              Toplam: {items.length} • Aktif: {activeCount}
            </div>
          </div>

          <div className="flex w-full max-w-md gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Yeni berber adı…"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
            />
            <button
              onClick={addBarber}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-white/90"
            >
              Ekle
            </button>
          </div>
        </div>

        {toast && (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80">
            {toast}
          </div>
        )}

        <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
          <div className="grid grid-cols-12 gap-0 border-b border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white/60">
            <div className="col-span-7">İsim</div>
            <div className="col-span-3">Durum</div>
            <div className="col-span-2 text-right">Aksiyon</div>
          </div>

          {items.map((b) => {
            const active = Boolean(b.is_active);
            return (
              <div key={b.id} className="grid grid-cols-12 items-center gap-0 px-3 py-3 text-sm text-white">
                <div className="col-span-7 font-medium">{b.name || "—"}</div>
                <div className="col-span-3">
                  <span
                    className={
                      "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold " +
                      (active
                        ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                        : "border-rose-400/20 bg-rose-500/10 text-rose-200")
                    }
                  >
                    {active ? "Aktif" : "Pasif"}
                  </span>
                </div>
                <div className="col-span-2 text-right">
                  <button
                    onClick={() => toggleActive(b.id, !active)}
                    className={
                      "rounded-lg border px-3 py-2 text-xs font-semibold " +
                      (active
                        ? "border-white/10 bg-white/5 text-white hover:bg-white/10"
                        : "border-white/10 bg-white/5 text-white hover:bg-white/10")
                    }
                  >
                    {active ? "Pasif et" : "Aktif et"}
                  </button>
                </div>
              </div>
            );
          })}

          {!loading && items.length === 0 && (
            <div className="px-3 py-6 text-sm text-white/60">Henüz berber yok.</div>
          )}

          {loading && <div className="px-3 py-6 text-sm text-white/60">Yükleniyor…</div>}
        </div>
      </div>
    </div>
  );
}
