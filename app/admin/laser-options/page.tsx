"use client";

import { useEffect, useMemo, useState } from "react";

const LASER_SERVICE_ID = "bcc32f20-d8e7-4d29-a03d-f4eb8bbc0f32";

type Row = {
  id: string;
  service_id: string;
  name: string;
  price: number;
  duration_min: number;
  is_active: boolean;
  sort_order: number;
};

export default function AdminLaserOptionsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [unauth, setUnauth] = useState(false);

  async function load() {
    setLoading(true);
    setUnauth(false);

    const res = await fetch(
      `/api/admin/service-options?service_id=${encodeURIComponent(LASER_SERVICE_ID)}`,
      { cache: "no-store" }
    );

    if (res.status === 401) {
      setUnauth(true);
      setLoading(false);
      // 1 sn sonra admin login sayfasına yönlendir
      setTimeout(() => {
        window.location.href = "/admin";
      }, 1000);
      return;
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoading(false);
      alert(data.error || "Lazer seçenekleri alınamadı");
      return;
    }

    setRows(data.rows ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function save(id: string, patch: Partial<Row>) {
    const res = await fetch("/api/admin/service-options", {
      method: "POST",
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
  }

  const totalActive = useMemo(() => rows.filter((r) => r.is_active).length, [rows]);

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const aFull = (a.name || "").toLowerCase().includes("tüm vücut");
      const bFull = (b.name || "").toLowerCase().includes("tüm vücut");
      if (aFull !== bFull) return aFull ? 1 : -1; // full body en sona
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });
    return copy;
  }, [rows]);

  return (
    <main className="min-h-screen bg-neutral-50 p-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Lazer Bölge Fiyatları</h1>
          <a className="text-sm underline" href="/admin">
            Admin Panel
          </a>
        </div>

        {unauth && (
          <div className="rounded-xl border bg-amber-50 p-4 text-amber-900">
            <div className="font-semibold">Giriş gerekli</div>
            <div className="text-sm">
              Admin oturumunuz yok. Şimdi giriş sayfasına yönlendiriliyorsunuz…
            </div>
          </div>
        )}

        {!unauth && (
          <div className="text-sm text-neutral-600">
            Aktif bölge sayısı: <b>{totalActive}</b>
          </div>
        )}

        <div className="rounded-2xl border bg-white shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-700">
              <tr>
                <th className="p-3 text-left">Bölge</th>
                <th className="p-3 text-left">Fiyat (TL)</th>
                <th className="p-3 text-left">Süre (dk)</th>
                <th className="p-3 text-left">Sıra</th>
                <th className="p-3 text-left">Aktif</th>
                <th className="p-3 text-right">İşlem</th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td className="p-6 text-neutral-500" colSpan={6}>
                    Yükleniyor…
                  </td>
                </tr>
              )}

              {!loading &&
                !unauth &&
                sortedRows.map((r) => (
                  <LaserRow key={r.id} row={r} onSave={save} />
                ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-neutral-500">
          Not: “Tüm vücut” seçeneği müşteride diğer seçimleri kilitler.
        </p>
      </div>
    </main>
  );
}

function LaserRow({
  row,
  onSave,
}: {
  row: Row;
  onSave: (id: string, patch: Partial<Row>) => Promise<void>;
}) {
  const [price, setPrice] = useState<number>(Number(row.price ?? 0));
  const [dur, setDur] = useState<number>(Number(row.duration_min ?? 0));
  const [sort, setSort] = useState<number>(Number(row.sort_order ?? 1));
  const [active, setActive] = useState<boolean>(!!row.is_active);

  return (
    <tr className="border-t">
      <td className="p-3">{row.name}</td>

      <td className="p-3">
        <input
          className="w-28 rounded border px-2 py-1"
          type="number"
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
        />
      </td>

      <td className="p-3">
        <input
          className="w-24 rounded border px-2 py-1"
          type="number"
          value={dur}
          onChange={(e) => setDur(Number(e.target.value))}
        />
      </td>

      <td className="p-3">
        <input
          className="w-20 rounded border px-2 py-1"
          type="number"
          value={sort}
          onChange={(e) => setSort(Number(e.target.value))}
        />
      </td>

      <td className="p-3">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
      </td>

      <td className="p-3 text-right">
        <button
          className="rounded-lg bg-black px-3 py-2 text-white"
          onClick={() =>
            onSave(row.id, {
              price,
              duration_min: dur,
              sort_order: sort,
              is_active: active,
            })
          }
        >
          Kaydet
        </button>
      </td>
    </tr>
  );
}
