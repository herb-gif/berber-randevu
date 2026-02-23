"use client";
import AdminNavTabs from "../ui/AdminNavTabs";

import { useEffect, useState } from "react";

type ResourceGroup = "hair" | "niyazi" | "external" | null;

type Row = {
  id: string;
  name: string;
  service_type: string;
  resource_group: ResourceGroup;
  price: number | null;
  is_active: boolean;
  default_duration_min: number;
};

type SavePatch = {
  price?: number;
  is_active?: boolean;
  resource_group?: ResourceGroup;
};

export default function AdminServicesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [unauth, setUnauth] = useState(false);
  const [toast, setToast] = useState<string>("");

  async function load() {
    setLoading(true);
    setUnauth(false);

    const res = await fetch("/api/admin/services", { credentials: "include", cache: "no-store" });

    if (res.status === 401) {
      setUnauth(true);
      setLoading(false);
      setTimeout(() => {
        window.location.href = "/admin";
      }, 1000);
      return;
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.error || "Hizmetler alınamadı");
      setLoading(false);
      return;
    }

    setRows((data.rows ?? []) as Row[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  // Toast auto-hide
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 1500);
    return () => clearTimeout(t);
  }, [toast]);

  async function save(id: string, patch: SavePatch) {
    const res = await fetch("/api/admin/services", { credentials: "include", cache: "no-store", method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });

    if (res.status === 401) {
      setUnauth(true);
      setTimeout(() => (window.location.href = "/admin"), 500);
      return;
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) return alert(data.error || "Kaydedilemedi");

    await load();
    setToast("Kaydedildi ✓");
  }

  return (
    <main className="min-h-screen bg-neutral-50 p-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-heading text-mc-bronze">Hizmet Ayarları</h1>
          <AdminNavTabs />
          <a
            className="rounded-xl border border-mc-border bg-white px-4 py-2 text-sm text-mc-dark hover:border-mc-bronze transition"
            href="/admin"
          >
            Admin Panel
          </a>
        </div>

        {toast && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-xl px-4">
            <div className="rounded-xl border border-mc-bronze/30 bg-[rgba(192,138,90,0.10)] px-4 py-3 text-sm text-neutral-900 shadow-sm">
              {toast}
            </div>
          </div>
        )}

        {unauth && (
          <div className="mx-auto w-full rounded-2xl border border-mc-border bg-white px-3 py-2 shadow-sm">
            <div className="font-semibold">Giriş gerekli</div>
            <div className="text-sm">Admin oturumunuz yok. Şimdi giriş sayfasına yönlendiriliyorsunuz…</div>
          </div>
        )}

        <div className="w-full rounded-2xl border border-mc-border bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm text-neutral-900">
            <thead className="bg-neutral-50 text-neutral-900 uppercase tracking-wide text-xs">
              <tr>
                <th className="text-neutral-900 font-semibold p-3 text-left">Hizmet</th>
                <th className="text-neutral-900 font-semibold p-3 text-left">Tür</th>
                <th className="text-neutral-900 font-semibold p-3 text-left">Kaynak</th>
                <th className="text-neutral-900 font-semibold p-3 text-left">Aktif</th>
                <th className="text-neutral-900 font-semibold p-3 text-left">Süre</th>
                <th className="text-neutral-900 font-semibold p-3 text-left">Fiyat (TL)</th>
                <th className="text-neutral-900 font-semibold p-3 text-right">İşlem</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-mc-border">
              {loading && (
                <tr>
                  <td className="p-6 text-neutral-500" colSpan={7}>
                    Yükleniyor…
                  </td>
                </tr>
              )}

              {!loading &&
                !unauth &&
                rows
                  .filter((r) => r.service_type !== "laser")
                  .map((r) => <ServiceRow key={r.id} row={r} onSave={save} />)}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-neutral-500">
          Not: Lazer fiyatları bölgelere göre yönetilir. Lazer için fiyat güncellemesini “Lazer Bölge Fiyatları”
          sekmesinden yapabilirsiniz.
        </p>
      </div>
    </main>
  );
}

function ServiceRow({ row, onSave }: { row: Row; onSave: (id: string, patch: SavePatch) => Promise<void> }) {
  const [price, setPrice] = useState<number>(Number(row.price ?? 0));
  const [isActive, setIsActive] = useState<boolean>(!!row.is_active);
  const [resourceGroup, setResourceGroup] = useState<ResourceGroup>(row.resource_group ?? null);
  const [saving, setSaving] = useState(false);

  const typeLabel =
    ({
      brow: "Kaş",
      facial: "Cilt",
      hair: "Saç",
      laser: "Lazer",
    }[row.service_type] ?? row.service_type);

  async function doSave() {
    setSaving(true);
    try {
      await onSave(row.id, {
        price,
        is_active: isActive,
        resource_group: resourceGroup,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="bg-white">
      <td className="p-4 align-middle">
        <span className="font-semibold text-neutral-900">{row.name}</span>
      </td>

      <td className="p-4 align-middle">
        <span className="text-[11px] px-2 py-0.5 rounded-lg border border-mc-border bg-white text-neutral-700">
          {typeLabel}
        </span>
      </td>

      <td className="p-4 align-middle">
        <select
          className="w-full rounded-lg border border-mc-border bg-white px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-mc-bronze/40 focus:border-mc-bronze"
          value={resourceGroup ?? ""}
          onChange={(e) => {
            const v = e.target.value.trim();
            setResourceGroup((v === "" ? null : (v as any)) as ResourceGroup);
          }}
        >
          <option value="">(auto)</option>
          <option value="hair">Hair</option>
          <option value="niyazi">Niyazi</option>
          <option value="external">External</option>
        </select>
        <div className="mt-1 text-[11px] text-neutral-500">
          ⚠️ Kaynak değişikliği çakışma kurallarını etkiler.
        </div>
      </td>

      <td className="p-4 align-middle">
        <label className="inline-flex items-center gap-2 select-none">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          <span className="text-sm text-neutral-700">{isActive ? "Aktif" : "Pasif"}</span>
        </label>
      </td>

      <td className="p-4 align-middle">
        <span className="text-[11px] px-2 py-0.5 rounded-lg border border-mc-border bg-white text-neutral-700">
          {row.default_duration_min} dk
        </span>
      </td>

      <td className="p-4 align-middle">
        <input
          className="w-full rounded-lg border border-mc-border bg-white px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-mc-bronze/40 focus:border-mc-bronze"
          type="number"
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
          min={0}
        />
      </td>

      <td className="p-3 text-right">
        <button
          className="rounded-xl px-4 py-2 text-sm bg-mc-black text-mc-bronze border border-mc-bronze hover:bg-mc-bronze hover:text-black transition disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={doSave}
          disabled={saving}
        >
          {saving ? "Kaydediliyor…" : "Kaydet"}
        </button>
      </td>
    </tr>
  );
}
