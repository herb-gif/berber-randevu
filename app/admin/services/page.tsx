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
    name?: string;
    service_type?: string;
    default_duration_min?: number;
price?: number;
  is_active?: boolean;
  resource_group?: ResourceGroup;
  };

export default function AdminServicesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [unauth, setUnauth] = useState(false);
  const [toast, setToast] = useState<string>("");

  

    const [newName, setNewName] = useState("");
    const [newType, setNewType] = useState<string>("facial");
    const [newRG, setNewRG] = useState<ResourceGroup>("external");
    const [newDur, setNewDur] = useState<number>(30);
    const [newPrice, setNewPrice] = useState<number>(0);
    const [newActive, setNewActive] = useState<boolean>(true);
    const [creating, setCreating] = useState<boolean>(false);
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

    async function createService() {
      const name = newName.trim();
      if (!name) return setToast("İsim gir");

      setCreating(true);
      try {
        const res = await fetch("/api/admin/services", {
          credentials: "include",
          cache: "no-store",
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            service_type: String(newType || "facial"),
            resource_group: newRG,
            default_duration_min: Number(newDur || 0),
            price: Number(newPrice || 0),
            is_active: Boolean(newActive),
          }),
        });

        if (res.status === 401) {
          setUnauth(true);
          setTimeout(() => (window.location.href = "/admin"), 500);
          return;
        }

        const data = await res.json().catch(() => ({}));
        if (!res.ok) return alert(data.error || "Eklenemedi");

        setNewName("");
        setNewType("facial");
        setNewRG("external");
        setNewDur(30);
        setNewPrice(0);
        setNewActive(true);

        await load();
        setToast("Eklendi ✓");
      } finally {
        setCreating(false);
      }
    }



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
    <main className="min-h-screen bg-neutral-950 p-6 text-neutral-100">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-heading text-mc-bronze">Hizmet Ayarları</h1>
          <AdminNavTabs />
          <a
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-neutral-100 hover:border-mc-bronze transition"
            href="/admin"
          >
            Admin Panel
          </a>
        </div>

        {toast && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-xl px-4">
            <div className="rounded-xl border border-mc-bronze/30 bg-[rgba(192,138,90,0.10)] px-4 py-3 text-sm text-neutral-100 shadow-sm">
              {toast}
            </div>
          </div>
        )}

        {unauth && (
          <div className="mx-auto w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 shadow-sm">
            <div className="font-semibold">Giriş gerekli</div>
            <div className="text-sm">Admin oturumunuz yok. Şimdi giriş sayfasına yönlendiriliyorsunuz…</div>
          </div>
        )}

        
          <div className="w-full rounded-2xl border border-white/10 bg-white/5 shadow-sm p-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-neutral-100">Yeni Hizmet Ekle</div>
                <div className="text-[12px] text-white/50">Wax / Ağda, Manikür & Pedikür gibi servisleri buradan ekleyebilirsin.</div>
              </div>
              <button
                className="rounded-xl px-4 py-2 text-sm bg-mc-black text-mc-bronze border border-mc-bronze hover:bg-mc-bronze hover:text-neutral-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={createService}
                disabled={creating}
              >
                {creating ? "Ekleniyor…" : "Ekle"}
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-6 gap-3">
              <div className="md:col-span-2">
                <div className="text-xs font-semibold text-white/70 mb-1">Ad</div>
                <input
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-neutral-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-mc-bronze/40 focus:border-mc-bronze"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Örn: Wax / Ağda"
                />
              </div>

              <div>
                <div className="text-xs font-semibold text-white/70 mb-1">Tür</div>
                <select
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-neutral-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-mc-bronze/40 focus:border-mc-bronze"
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                >
                  <option value="hair">Saç</option>
                  <option value="laser">Lazer</option>
                  <option value="facial">Cilt</option>
                  <option value="brow">Kaş</option>
                  <option value="other">Diğer</option>
                </select>
              </div>

              <div>
                <div className="text-xs font-semibold text-white/70 mb-1">Kaynak</div>
                <select
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-neutral-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-mc-bronze/40 focus:border-mc-bronze"
                  value={newRG ?? "external"}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    setNewRG((v === "" ? null : (v as any)) as any);
                  }}
                >
                  <option value="hair">Hair (Berber)</option>
                  <option value="niyazi">Niyazi</option>
                  <option value="external">External</option>
                  <option value="">(auto)</option>
                </select>
              </div>

              <div>
                <div className="text-xs font-semibold text-white/70 mb-1">Süre (dk)</div>
                <input
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-neutral-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-mc-bronze/40 focus:border-mc-bronze"
                  type="number"
                  min={1}
                  value={newDur}
                  onChange={(e) => setNewDur(Number(e.target.value))}
                />
              </div>

              <div>
                <div className="text-xs font-semibold text-white/70 mb-1">Fiyat (TL)</div>
                <input
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-neutral-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-mc-bronze/40 focus:border-mc-bronze"
                  type="number"
                  min={0}
                  value={newPrice}
                  onChange={(e) => setNewPrice(Number(e.target.value))}
                />
              </div>

              <div className="flex items-center gap-2 md:justify-end">
                <label className="inline-flex items-center gap-2 select-none mt-6">
                  <input type="checkbox" checked={newActive} onChange={(e) => setNewActive(e.target.checked)} />
                  <span className="text-sm text-white/70">{newActive ? "Aktif" : "Pasif"}</span>
                </label>
              </div>
            </div>
          </div>

<div className="w-full rounded-2xl border border-white/10 bg-neutral-900 shadow-sm overflow-hidden">
          <table className="w-full text-sm text-neutral-100">
            <thead className="bg-white/5 text-neutral-100 uppercase tracking-wide text-xs">
              <tr>
                <th className="text-neutral-100 font-semibold p-3 text-left">Hizmet</th>
                <th className="text-neutral-100 font-semibold p-3 text-left">Tür</th>
                <th className="text-neutral-100 font-semibold p-3 text-left">Kaynak</th>
                <th className="text-neutral-100 font-semibold p-3 text-left">Aktif</th>
                <th className="text-neutral-100 font-semibold p-3 text-left">Süre</th>
                <th className="text-neutral-100 font-semibold p-3 text-left">Fiyat (TL)</th>
                <th className="text-neutral-100 font-semibold p-3 text-right">İşlem</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-mc-border">
              {loading && (
                <tr>
                  <td className="p-6 text-white/50" colSpan={7}>
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

        <p className="text-xs text-white/50">
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
  

    const [name, setName] = useState<string>(row.name ?? "");
    const [serviceType, setServiceType] = useState<string>(row.service_type ?? "other");
    const [durationMin, setDurationMin] = useState<number>(row.default_duration_min ?? 30);
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
          name,
          service_type: serviceType,
          default_duration_min: durationMin,
price,
        is_active: isActive,
        resource_group: resourceGroup,
        });
} finally {
      setSaving(false);
    }
  }

  return (
    <tr className="bg-transparent hover:bg-white/5 transition">
      <td className="p-4 align-middle">
        <input className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-neutral-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-mc-bronze/40 focus:border-mc-bronze" value={name} onChange={(e) => setName(e.target.value)} />
      </td>

      <td className="p-4 align-middle">
          <select
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-neutral-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-mc-bronze/40 focus:border-mc-bronze"
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value)}
          >
            <option value="hair">Saç</option>
            <option value="laser">Lazer</option>
            <option value="facial">Cilt</option>
            <option value="brow">Kaş</option>
            <option value="other">Diğer</option>
          </select>
        </td>

      <td className="p-4 align-middle">
        <select
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-neutral-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-mc-bronze/40 focus:border-mc-bronze"
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
        <div className="mt-1 text-[11px] text-white/50">
          ⚠️ Kaynak değişikliği çakışma kurallarını etkiler.
        </div>
      </td>

      <td className="p-4 align-middle">
        <label className="inline-flex items-center gap-2 select-none">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          <span className="text-sm text-white/70">{isActive ? "Aktif" : "Pasif"}</span>
        </label>
      </td>

      <td className="p-4 align-middle">
        <input className="w-28 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-neutral-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-mc-bronze/40 focus:border-mc-bronze" type="number" min={1} value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))} />
      </td>

      <td className="p-4 align-middle">
        <input
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-neutral-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-mc-bronze/40 focus:border-mc-bronze"
          type="number"
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
          min={0}
        />
      </td>

      <td className="p-3 text-right">
        <button
          className="rounded-xl px-4 py-2 text-sm bg-mc-black text-mc-bronze border border-mc-bronze hover:bg-mc-bronze hover:text-neutral-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={doSave}
          disabled={saving}
        >
          {saving ? "Kaydediliyor…" : "Kaydet"}
        </button>
      </td>
    </tr>
  );
}
