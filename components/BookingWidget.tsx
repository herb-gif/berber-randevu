"use client";

import { useMemo, useState } from "react";

type Service = {
  id: number;
  name: string;
  default_duration_min: number;
  is_variable_duration: boolean;
  min_duration_min: number | null;
  max_duration_min: number | null;
  is_active: boolean;
};

type Barber = { id: number; name: string; is_active: boolean };

export default function BookingWidget() {
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>([]);
  const [date, setDate] = useState<string>("");
  const [slots, setSlots] = useState<string[]>([]);
  const [picked, setPicked] = useState<string>("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const totalDurationMin = useMemo(() => {
    const chosen = services.filter((s) => selectedServiceIds.includes(s.id));
    if (chosen.length === 0) return 0;
    return chosen.reduce((sum, s) => sum + (s.default_duration_min ?? 0), 0);
  }, [services, selectedServiceIds]);

  async function init() {
    if (loaded) return;
    const sRes = await fetch("/api/init").then((r) => r.json());
    setServices(sRes.services ?? []);
    setBarbers((sRes.barbers ?? []).map((b: any) => ({ ...b, id: String(b.id) })));
    setLoaded(true);
  }

  async function getSlots() {
    if (!date) return alert("Tarih seç");
    if (totalDurationMin <= 0) return alert("En az 1 hizmet seç");
    setPicked("");
    const q = new URLSearchParams({
      date,
      durationMin: String(totalDurationMin),
    });
    const res = await fetch(`/api/availability?${q.toString()}`);
    const data = await res.json();
    if (!res.ok) return alert(data.error || "Uygun saatler alınamadı");
    setSlots(data.slots ?? []);
  }

  async function book() {
    if (selectedServiceIds.length === 0) return alert("Hizmet seç");
    if (!date) return alert("Tarih seç");
    if (!picked) return alert("Saat seç");
    if (!name.trim()) return alert("Ad Soyad gir");
    if (!phone.trim()) return alert("Telefon gir");

    const service_id = selectedServiceIds[0];

    const start = new Date(`${date}T${picked}:00`);
    const end = new Date(start.getTime() + totalDurationMin * 60000);

    const res = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id,
        barber_id: null,
        customer_name: name,
        customer_phone: phone,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
      }),
    });

    const data = await res.json();
    if (!res.ok) return alert(data.error || "Randevu oluşturulamadı");

    alert("Randevu oluşturuldu ✅");
    setName("");
    setPhone("");
    setSlots([]);
    setPicked("");
  }

  return (
    <div onMouseEnter={init} className="rounded-2xl border bg-white p-6 shadow-sm">
      <p className="text-sm text-neutral-600">
        İptal: Randevuya en az 2 saat kala iptal edilebilir.
      </p>

      <h2 className="mt-6 text-xl font-semibold">Hizmetler</h2>

      <div className="mt-3 space-y-3">
        {services
          .filter((s) => s.is_active)
          .map((s) => (
            <label key={s.id} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedServiceIds.includes(s.id)}
                  onChange={(e) => {
                    setSelectedServiceIds((prev) =>
                      e.target.checked ? [...prev, s.id] : prev.filter((x) => x !== s.id)
                    );
                  }}
                />
                <span>{s.name}</span>
              </span>

              <span className="text-sm text-neutral-500">
                {s.is_variable_duration
                  ? `${s.min_duration_min ?? 0}–${s.max_duration_min ?? 0} dk`
                  : `${s.default_duration_min} dk`}
              </span>
            </label>
          ))}
      </div>

      <h2 className="mt-8 text-xl font-semibold">Tarih</h2>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          type="date"
          className="rounded-lg border px-3 py-2"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <button onClick={getSlots} className="rounded-lg bg-black px-4 py-2 text-white">
          Uygun Saatleri Göster
        </button>
      </div>

      {slots.length > 0 && (
        <>
          <h3 className="mt-6 font-medium">Uygun Saatler</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {slots.map((s) => (
              <button
                key={s}
                onClick={() => setPicked(s)}
                className={`rounded border px-3 py-2 ${
                  picked === s ? "bg-black text-white" : "bg-white"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="mt-6 space-y-3">
        <input
          placeholder="Ad Soyad"
          className="w-full rounded-lg border px-3 py-3"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          placeholder="Telefon"
          className="w-full rounded-lg border px-3 py-3"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>

      <button onClick={book} className="mt-5 rounded-lg bg-emerald-600 px-4 py-2 text-white">
        Randevu Oluştur
      </button>

      <p className="mt-3 text-xs text-neutral-500">
        Not: Artık demo değil — randevu Supabase’e yazılıyor.
      </p>
    </div>
  );
}
