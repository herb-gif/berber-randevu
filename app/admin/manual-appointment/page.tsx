"use client";

import { useEffect, useMemo, useState } from "react";
import AdminNavTabs from "../ui/AdminNavTabs";

type Service = {
  id: string;
  name: string;
  default_duration_min: number | null;
  is_active: boolean;
  service_type: string;
};

type Barber = { id: string; name: string; is_active: boolean };

type ServiceOption = {
  id: string;
  service_id: string;
  name: string;
  price: number;
  duration_min: number;
};

function serviceDurationMin(s: Service) {
  return Number(s.default_duration_min ?? 0) || 0;
}

function normalizeType(s: Service): "hair" | "laser" | "facial" | "brow" | "other" {
  const t = (s.service_type || "").toLowerCase().trim();
  if (t === "hair" || t === "laser" || t === "facial" || t === "brow") return t as any;
  const n = (s.name || "").toLowerCase();
  if (n.includes("saç") || n.includes("sakal")) return "hair";
  if (n.includes("lazer") || n.includes("laser")) return "laser";
  if (n.includes("hydra") || n.includes("facial")) return "facial";
  if (n.includes("kaş") || n.includes("kas") || n.includes("brow")) return "brow";
  return "other";
}

export default function AdminManualAppointmentPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedBarberId, setSelectedBarberId] = useState<string>("");

  const [date, setDate] = useState<string>("");
  const [slots, setSlots] = useState<string[]>([]);
  const [picked, setPicked] = useState<string>("");

  // Manuel saat (admin isterse slot dışı girsin)
  const [manualTime, setManualTime] = useState<string>("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const [depositStatus, setDepositStatus] = useState<"pending" | "required" | "paid">("pending");
  const [depositAmount, setDepositAmount] = useState<number>(0);

  const [laserOptions, setLaserOptions] = useState<ServiceOption[]>([]);
  const [selectedLaserOptionIds, setSelectedLaserOptionIds] = useState<string[]>([]);
  const [toast, setToast] = useState<string>("");

  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/init", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      setServices((data.services ?? []).map((s: any) => ({ ...s, id: String(s.id) })));
      setBarbers((data.barbers ?? []).map((b: any) => ({ ...b, id: String(b.id) })));
      setLoaded(true);
    })().catch(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const activeServices = useMemo(() => services.filter((s) => s.is_active), [services]);
  const activeBarbers = useMemo(() => barbers.filter((b) => b.is_active), [barbers]);

  const selectedServices = useMemo(
    () => activeServices.filter((s) => selectedServiceIds.includes(s.id)),
    [activeServices, selectedServiceIds]
  );

  const hairSelected = useMemo(
    () => selectedServices.some((s) => normalizeType(s) === "hair"),
    [selectedServices]
  );

  useEffect(() => {
    if (!hairSelected) setSelectedBarberId("");
  }, [hairSelected]);

  const laserServiceId = useMemo(() => {
    const laser = selectedServices.find((s) => normalizeType(s) === "laser");
    return laser ? laser.id : "";
  }, [selectedServices]);

  async function fetchLaserOptions(laserId: string) {
    const res = await fetch(`/api/service-options?service_id=${encodeURIComponent(laserId)}`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setToast(data.error || "Lazer seçenekleri alınamadı");
      return;
    }
    setLaserOptions((data.options ?? []).map((o: any) => ({ ...o, id: String(o.id), service_id: String(o.service_id) })));
  }

  useEffect(() => {
    if (!laserServiceId) {
      setLaserOptions([]);
      setSelectedLaserOptionIds([]);
      return;
    }
    fetchLaserOptions(laserServiceId);
  }, [laserServiceId]);

  const laserSelectedOptions = useMemo(() => {
    if (!laserServiceId) return [];
    const map = new Map(laserOptions.map((o) => [o.id, o]));
    return selectedLaserOptionIds.map((id) => map.get(id)).filter(Boolean) as ServiceOption[];
  }, [laserServiceId, laserOptions, selectedLaserOptionIds]);

  const totalDurationMin = useMemo(() => {
    let base = selectedServices.reduce((sum, s) => sum + serviceDurationMin(s), 0);
    // lazer seçenekleri durasyonu ek (varsa)
    if (laserServiceId) {
      // lazer servisin default süresini çıkarıp opsiyon sürelerini ekleyelim
      const laserSvc = selectedServices.find((s) => normalizeType(s) === "laser");
      if (laserSvc) base -= serviceDurationMin(laserSvc);
      base += laserSelectedOptions.reduce((sum, o) => sum + Number(o.duration_min || 0), 0);
    }
    return Math.max(0, base);
  }, [selectedServices, laserServiceId, laserSelectedOptions]);

  const orderedSelected = useMemo(() => {
    const order: Record<string, number> = { hair: 1, facial: 2, laser: 3, brow: 4, other: 9 };
    return [...selectedServices].sort(
      (a, b) => (order[normalizeType(a)] ?? 9) - (order[normalizeType(b)] ?? 9)
    );
  }, [selectedServices]);

  const flowText = useMemo(() => {
    if (orderedSelected.length === 0) return "—";
    return orderedSelected.map((s) => s.name).join(" → ");
  }, [orderedSelected]);


  async function getSlots() {
    if (selectedServiceIds.length === 0) return setToast("Hizmet seç");
    if (!date) return setToast("Tarih seç");
    if (hairSelected && !selectedBarberId) return setToast("Berber seç");
    if (laserServiceId && selectedLaserOptionIds.length === 0) return setToast("Lazer bölgesi seç");

    setPicked("");
    setSlots([]);
    setLoadingSlots(true);

    try {
      const q = new URLSearchParams();
      q.set("date", date);
      q.set("serviceIds", selectedServiceIds.join(","));
      if (hairSelected) q.set("barberId", selectedBarberId);
      q.set("durationMin", String(totalDurationMin || 1));

      const res = await fetch(`/api/availability?${q.toString()}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setToast(data.error || "Uygun saatler alınamadı");
      setSlots(data.slots ?? []);
    } finally {
      setLoadingSlots(false);
    }
  }

  async function createManual() {
    if (selectedServiceIds.length === 0) return setToast("Hizmet seç");
    if (!date) return setToast("Tarih seç");
    if (!name.trim()) return setToast("Ad Soyad gir");
    if (!phone.trim()) return setToast("Telefon gir");
    if (hairSelected && !selectedBarberId) return setToast("Berber seç");
    if (laserServiceId && selectedLaserOptionIds.length === 0) return setToast("Lazer bölgesi seç");

    const finalTime = (manualTime || picked || "").trim();
    if (!finalTime) return setToast("Saat seç veya manuel saat gir");

    setSaving(true);
    try {
      const res = await fetch("/api/admin/manual-appointment", { credentials: "include", cache: "no-store", method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceIds: selectedServiceIds,
          barberId: hairSelected ? selectedBarberId : null,
          customer_name: name,
          customer_phone: phone,
          date,
          time: finalTime,
          laser_option_ids: selectedLaserOptionIds,
          deposit_status: depositStatus,
          deposit_amount: depositAmount, }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409) {
          setToast(data.error || "Bu saat artık dolu. Admin paneline dönülüyor…");
          window.setTimeout(() => {
            window.location.href = "/admin?toast=slot_taken";
          }, 350);
          return;
        }
        return setToast(data.error || "Oluşturulamadı");
      }

      setToast(`Manuel randevu eklendi ✅ (#${String(data.id).slice(0, 6)})`);
      setPicked("");
      setManualTime("");
      setName("");
      setPhone("");
      setSelectedServiceIds([]);
      setSelectedBarberId("");
      setSelectedLaserOptionIds([]);
      setSlots([]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-950 p-6 text-neutral-100">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-heading text-mc-bronze">Yeni Randevu Ekle (Manuel)</h1>
          <AdminNavTabs />
          <a className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-neutral-100 hover:border-mc-bronze transition" href="/admin">
            Admin Panel
          </a>
        </div>

        {toast && (
          <div className="rounded-xl border border-mc-bronze/30 bg-[rgba(192,138,90,0.10)] px-4 py-3 text-sm text-neutral-100 shadow-sm">
            {toast}
          </div>
        )}

        {!loaded && <div className="text-sm text-white/50">Yükleniyor…</div>}

        <div className="rounded-2xl border border-white/10 bg-neutral-900 p-4 shadow-sm space-y-4">
          <div>
            <div className="text-sm font-semibold text-neutral-100">Hizmetler</div>
            <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs text-white/60">Hizmet akışı</div>
              <div className="mt-1 text-sm font-medium text-neutral-100">{flowText}</div>
              <div className="mt-1 text-xs text-white/60">
                Toplam süre: <span className="font-medium text-neutral-100">{totalDurationMin} dk</span>
              </div>
            </div>

            <div className="mt-2 space-y-2">
{activeServices.map((s) => {
  const checked = selectedServiceIds.includes(s.id);
  const t = normalizeType(s);
  const typeLabel =
    ({ hair: "Saç", facial: "Cilt", laser: "Lazer", brow: "Kaş", other: "Diğer" } as any)[t] ?? t;

  return (
    <label
      key={s.id}
      className={`flex items-center justify-between rounded-xl border p-3 transition ${
        checked ? "border-mc-bronze bg-[rgba(192,138,90,0.06)]" : "border-white/10 bg-white"
      }`}
    >
      <span className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => {
            setSelectedServiceIds((prev) =>
              e.target.checked ? [...prev, s.id] : prev.filter((x) => x !== s.id)
            );
          }}
        />

        <span className="flex flex-col">
          <span className="font-medium text-neutral-100">{s.name}</span>
          <span className="mt-1 inline-flex items-center gap-2">
            <span className="text-[11px] px-2 py-0.5 rounded-lg border border-white/10 bg-white text-white/70">
              {typeLabel}
            </span>
          </span>
        </span>
      </span>

      <span className="text-xs text-white/60">{serviceDurationMin(s)} dk</span>
    </label>
  );
})}

            </div>
          </div>

          {laserServiceId && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-sm font-semibold">Lazer Bölgesi</div>
              <div className="mt-2 space-y-2">
                {laserOptions.map((o) => {
                  const checked = selectedLaserOptionIds.includes(o.id);
                  return (
                    <label key={o.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white p-3">
                      <span className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setSelectedLaserOptionIds((prev) =>
                              e.target.checked ? [...prev, o.id] : prev.filter((x) => x !== o.id)
                            );
                          }}
                        />
                        <span className="font-medium">{o.name}</span>
                      </span>
                      <span className="text-xs text-white/60">{o.price} TL • {o.duration_min} dk</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {hairSelected && (
            <div>
              <div className="text-sm font-semibold text-neutral-100">Berber</div>
              <select
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                value={selectedBarberId}
                onChange={(e) => setSelectedBarberId(e.target.value)}
              >
                <option value="">Seçiniz</option>
                {activeBarbers.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <div className="text-sm font-semibold text-neutral-100">Tarih</div>
              <input
                type="date"
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div>
              <div className="text-sm font-semibold text-neutral-100">Manuel Saat</div>
              <input
                type="time"
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                value={manualTime}
                onChange={(e) => setManualTime(e.target.value)}
              />
              <div className="mt-1 text-[11px] text-white/50">Slot dışı saat girebilirsiniz.</div>
            </div>

            <div className="flex items-end">
              <button
                onClick={getSlots}
                disabled={loadingSlots}
                className="w-full rounded-xl px-4 py-2 bg-mc-black text-mc-bronze border border-mc-bronze hover:bg-mc-bronze hover:text-neutral-100 transition disabled:opacity-50"
              >
                {loadingSlots ? "Kontrol…" : "Uygun Saatleri Göster"}
              </button>
            </div>
          </div>
          {!loadingSlots && date && selectedServiceIds.length > 0 && slots.length === 0 && (
            <div className="text-sm text-white/60">
              Bu kriterlerle uygun slot bulunamadı. İstersen manuel saat girebilirsin.
            </div>
          )}

          {slots.length > 0 && (
            <div>
              <div className="text-sm font-semibold text-neutral-100">Slot seç</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {slots.map((s) => (
                  <button
                    key={s}
                    onClick={() => setPicked(s)}
                    className={`rounded-xl border px-3 py-2 text-sm ${
                      picked === s ? "bg-mc-black text-mc-bronze border-mc-bronze" : "bg-white border-white/10"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-sm font-semibold text-neutral-100">Müşteri Ad Soyad</div>
              <input
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <div className="text-sm font-semibold text-neutral-100">Telefon</div>
              <input
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                value={phone}
                onChange={(e) => {
                  const v = e.target.value;
                  const cleaned = v.startsWith("+") ? "+" + v.slice(1).replace(/[^0-9]/g, "") : v.replace(/[^0-9]/g, "");
                  setPhone(cleaned);
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <div className="text-sm font-semibold text-neutral-100">Depozito Durumu</div>
              <select
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                value={depositStatus}
                onChange={(e) => setDepositStatus(e.target.value as any)}
              >
                <option value="pending">Pending</option>
                <option value="required">Required</option>
                <option value="paid">Paid</option>
              </select>
            </div>
            <div>
              <div className="text-sm font-semibold text-neutral-100">Depozito Tutarı</div>
              <input
                type="number"
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                value={depositAmount}
                onChange={(e) => setDepositAmount(Number(e.target.value))}
                min={0}
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={createManual}
                disabled={saving}
                className="w-full rounded-xl px-4 py-2 bg-mc-black text-mc-bronze border border-mc-bronze hover:bg-mc-bronze hover:text-neutral-100 transition disabled:opacity-50"
              >
                {saving ? "Kaydediliyor…" : "Randevuyu Oluştur"}
              </button>
            </div>
          </div>

          <div className="text-xs text-white/50">
            Not: Bu ekran işletmecinin manuel randevu girmesi içindir. Mesai dışı saat girilebilir; çakışma varsa sistem izin vermez.
          </div>
        </div>

        <div className="text-sm">
          <a className="underline text-white/70" href="/admin/services">Servis Ayarları</a>
        </div>
      </div>
    </main>
  );
}
