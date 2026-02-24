"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { buildDepositPaymentMessage, buildWhatsAppWebUrl } from "@/lib/whatsapp";

type Service = {
  id: string; // UUID
  name: string;
  default_duration_min: number | null;
  is_variable_duration: boolean;
  min_duration_min: number | null;
  max_duration_min: number | null;
  is_active: boolean;
  service_type: "hair" | "laser" | "facial" | "brow" | string;
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
  if (s.is_variable_duration) return s.default_duration_min ?? s.min_duration_min ?? 30;
  return s.default_duration_min ?? 30;
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

function addMinutesToHHMM(hhmm: string, addMin: number) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return hhmm;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  let total = hh * 60 + mm + addMin;
  total = ((total % (24 * 60)) + (24 * 60)) % (24 * 60);
  const outH = String(Math.floor(total / 60)).padStart(2, "0");
  const outM = String(total % 60).padStart(2, "0");
  return `${outH}:${outM}`;
}


export default function BookingWidget() {
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedBarberId, setSelectedBarberId] = useState<string>("");

  const [date, setDate] = useState<string>("");
  const [slots, setSlots] = useState<string[]>([]);


  

  const [timeTab, setTimeTab] = useState<"morning" | "noon" | "evening">("morning");
  const filteredSlots = useMemo(() => {
    const now = new Date();

    // local today YYYY-MM-DD
    const todayISO =
      now.getFullYear() +
      "-" +
      String(now.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(now.getDate()).padStart(2, "0");

    // date normalize (YYYY-MM-DD ya da dd/mm/yyyy)
    let selectedISO = String(date || "").trim();
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(selectedISO)) {
      const parts = selectedISO.split("/");
      selectedISO = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    }

    if (selectedISO !== todayISO) return slots;

    const SLOT_GRACE_MIN = 20;

    return slots.filter((hhmm) => {
      const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
      if (!m) return true;

      const slot = new Date(now);
      slot.setHours(Number(m[1]), Number(m[2]), 0, 0);

      // slot zamanı + 20dk'ya kadar "alınabilir"
      const slotCutoff = new Date(slot.getTime() + SLOT_GRACE_MIN * 60 * 1000);
      return now <= slotCutoff;
    });
  }, [slots, date]);

  useEffect(() => {
    if (!filteredSlots || filteredSlots.length === 0) return;

    const toMin = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };

    const morning = filteredSlots.filter((t) => toMin(t) < 12 * 60);
    const noon = filteredSlots.filter((t) => toMin(t) >= 12 * 60 && toMin(t) < 17 * 60);
    const evening = filteredSlots.filter((t) => toMin(t) >= 17 * 60);

    if (timeTab === "morning" && morning.length === 0) {
      if (noon.length > 0) return setTimeTab("noon");
      if (evening.length > 0) return setTimeTab("evening");
    }
    if (timeTab === "noon" && noon.length === 0) {
      if (morning.length > 0) return setTimeTab("morning");
      if (evening.length > 0) return setTimeTab("evening");
    }
    if (timeTab === "evening" && evening.length === 0) {
      if (noon.length > 0) return setTimeTab("noon");
      if (morning.length > 0) return setTimeTab("morning");
    }
  }, [filteredSlots, timeTab]);

  const [picked, setPicked] = useState<string>("");


  const previewRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!picked) return;
    const t = setTimeout(() => {
      previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
    return () => clearTimeout(t);
  }, [picked]);

  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (!picked) {
      setShowPreview(false);
      return;
    }
    // picked seçildiğinde: önce kapalı, sonra 1 frame sonra aç (transition için)
    setShowPreview(false);
    const raf = requestAnimationFrame(() => setShowPreview(true));
    return () => cancelAnimationFrame(raf);
  }, [picked]);

const slotBtnClass = (t: string) =>
    `inline-flex items-center justify-center px-3 py-2 rounded-xl border text-sm transition select-none hover:-translate-y-0.5 active:scale-[0.98] duration-150 ` +
    (picked === t
      ? `bg-mc-black text-mc-bronze border-mc-bronze shadow-[0_0_0_2px_rgba(192,138,90,0.30)]`
      : `bg-white text-mc-dark border-mc-border hover:border-mc-bronze hover:shadow-[0_0_0_2px_rgba(192,138,90,0.15)] hover:shadow-sm`);


  function BarberSelectModal() {
    const [open, setOpen] = useState(false);

    const selected = activeBarbers.find((b) => b.id === selectedBarberId);

    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 flex w-full items-center justify-between rounded-2xl border border-mc-border bg-white px-4 py-3 text-left hover:border-mc-bronze hover:shadow-[0_0_0_2px_rgba(192,138,90,0.10)] transition"
        >
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-neutral-900">
              {selected ? selected.name : "Berber seç"}
            </div>
</div>
          <span className="text-neutral-400">▾</span>
        </button>

        {open && (
          <div className="fixed inset-0 z-50">
            {/* Backdrop */}
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              onClick={() => setOpen(false)}
              aria-label="Kapat"
            />

            {/* Bottom sheet / modal */}
            <div className="absolute bottom-0 left-0 right-0 max-h-[80vh] rounded-t-3xl bg-white p-4 shadow-2xl">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-base font-semibold text-neutral-900">Berber Seç</div>
                <button
                  type="button"
                  className="rounded-xl px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100"
                  onClick={() => setOpen(false)}
                >
                  Kapat
                </button>
              </div>

              <div className="space-y-2 overflow-auto pb-2">
                {activeBarbers.map((b) => {
                  const active = b.id === selectedBarberId;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        setSelectedBarberId(b.id);
                        setOpen(false);
                      }}
                      className={[
                        "flex w-full items-center justify-between rounded-2xl border p-3 text-left transition",
                        active
                          ? "border-mc-bronze bg-[rgba(192,138,90,0.08)]"
                          : "border-mc-border bg-white hover:border-mc-bronze/60",
                      ].join(" ")}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-neutral-900">{b.name}</div>
</div>
                      {active && <span className="text-sm font-semibold text-mc-bronze">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking] = useState(false);

  // Lazer options
  const [laserOptions, setLaserOptions] = useState<ServiceOption[]>([]);
  const [selectedLaserOptionIds, setSelectedLaserOptionIds] = useState<string[]>([]);
  const [laserTotalPrice, setLaserTotalPrice] = useState(0);

  const [toast, setToast] = useState<string>("");
  const [waLink, setWaLink] = useState<string>("");

  // INIT
  useEffect(() => {
    (async () => {
      const res = await fetch("/api/init", { cache: "no-store" });
      const data = await res.json();

      setServices((data.services ?? []).map((s: any) => ({ ...s, id: String(s.id) })));
      setBarbers((data.barbers ?? []).map((b: any) => ({ ...b, id: String(b.id) })));
      setLoaded(true);
    })().catch((e) => {
      console.error("init failed", e);
      setLoaded(true);
    });
  }, []);

  // Toast auto hide
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

  // Hair yoksa berberi temizle
  useEffect(() => {
    if (!hairSelected) setSelectedBarberId("");
  }, [hairSelected]);

  // Hair var ve tek berber varsa auto select
  useEffect(() => {
    if (hairSelected && !selectedBarberId && activeBarbers.length === 1) {
      setSelectedBarberId(activeBarbers[0].id);
    }
  }, [hairSelected, selectedBarberId, activeBarbers]);

  const laserServiceId = useMemo(() => {
    const laser = selectedServices.find((s) => normalizeType(s) === "laser");
    return laser ? laser.id : "";
  }, [selectedServices]);

  async function fetchLaserOptions(laserId: string) {
    const res = await fetch(`/api/service-options?service_id=${encodeURIComponent(laserId)}`, {
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setToast(data.error || "Lazer seçenekleri alınamadı");
      return;
    }
    setLaserOptions((data.options ?? []).map((o: any) => ({
      ...o,
      id: String(o.id),
      service_id: String(o.service_id),
    })));
  }

  // Lazer seçilince options çek / sıfırla
  useEffect(() => {
    if (!laserServiceId) {
      setLaserOptions([]);
      setSelectedLaserOptionIds([]);
      setLaserTotalPrice(0);
      return;
    }
    fetchLaserOptions(laserServiceId);
  }, [laserServiceId]);

  const laserSelectedOptions = useMemo(() => {
    if (!laserServiceId) return [];
    const map = new Map(laserOptions.map((o) => [o.id, o]));
    return selectedLaserOptionIds.map((id) => map.get(id)).filter(Boolean) as ServiceOption[];
  }, [laserServiceId, laserOptions, selectedLaserOptionIds]);

  const laserExtraDuration = useMemo(() => {
    return laserSelectedOptions.reduce((sum, o) => sum + Number(o.duration_min || 0), 0);
  }, [laserSelectedOptions]);

  useEffect(() => {
    const total = laserSelectedOptions.reduce((sum, o) => sum + Number(o.price || 0), 0);
    setLaserTotalPrice(total);
  }, [laserSelectedOptions]);

  // Toplam süre: servisler + (lazer seçiliyse lazer default süresini çıkar, lazer seçenek sürelerini ekle)
  const totalDurationMin = useMemo(() => {
    let base = selectedServices.reduce((sum, s) => sum + serviceDurationMin(s), 0);
    if (laserServiceId) {
      const laserSvc = selectedServices.find((s) => normalizeType(s) === "laser");
      if (laserSvc) base -= serviceDurationMin(laserSvc);
      base += laserExtraDuration;
    }
    return Math.max(0, base);
  }, [selectedServices, laserServiceId, laserExtraDuration]);

  // Hizmet sırası (hair -> facial -> laser -> brow)
  const orderedSelected = useMemo(() => {
    const order: Record<string, number> = { hair: 1, facial: 2, laser: 3, brow: 4, other: 9 };
    return [...selectedServices].sort((a, b) => (order[normalizeType(a)] ?? 9) - (order[normalizeType(b)] ?? 9));
  }, [selectedServices]);

  const flowText = useMemo(() => {
    if (orderedSelected.length === 0) return "";
    return orderedSelected.map((s) => s.name).join(" → ");
  }, [orderedSelected]);

  const previewSegments = useMemo(() => {
    if (!date || !picked || orderedSelected.length === 0) return [];
    let cursor = picked;
    const out: Array<{ name: string; start: string; end: string; resource: string }> = [];

    for (const svc of orderedSelected) {
      let dur = serviceDurationMin(svc);

      // lazer seçiliyse lazerin süresini bölge sürelerinden al
      if (normalizeType(svc) === "laser" && laserServiceId) {
        dur = laserExtraDuration || dur;
      }

      const next = addMinutesToHHMM(cursor, dur);
      out.push({
        name:
          normalizeType(svc) === "laser" && laserSelectedOptions.length
            ? `Lazer: ${laserSelectedOptions.map((o) => o.name).join(" + ")}`
            : svc.name,
        start: cursor,
        end: next,
        resource: normalizeType(svc) === "hair" ? "Berber" : "Niyazi",
      });
      cursor = next;
    }
    return out;
  }, [date, picked, orderedSelected, laserServiceId, laserExtraDuration, laserSelectedOptions]);

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

      // lazer seçiliyse ekstra süreyi server'a taşımak için durationMin yolluyoruz (opsiyonel)
      q.set("durationMin", String(totalDurationMin));

      const res = await fetch(`/api/availability?${q.toString()}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) return setToast(data.error || "Uygun saatler alınamadı");
      setSlots(data.slots ?? []);
    } finally {
      setLoadingSlots(false);
    }
  }

  async function book() {
    if (booking) return;
    if (selectedServiceIds.length === 0) return setToast("Hizmet seç");
    if (!date) return setToast("Tarih seç");
    if (!picked) return setToast("Saat seç");
    if (!name.trim()) return setToast("Ad Soyad gir");
    if (!phone.trim()) return setToast("Telefon gir");
    if (hairSelected && !selectedBarberId) return setToast("Berber seç");
    if (laserServiceId && selectedLaserOptionIds.length === 0) return setToast("Lazer bölgesi seç");

    setBooking(true);
    try {
      // service_summary için lazer bölgeleri metni gönderiyoruz (MVP)
      const laserText = laserSelectedOptions.length
        ? laserSelectedOptions.map((o) => o.name).join(" + ")
        : "";

      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceIds: selectedServiceIds,
          barberId: hairSelected ? selectedBarberId : null,
          customer_name: name,
          customer_phone: phone,
          date,
          time: picked,
          laser_option_ids: selectedLaserOptionIds,
          laser_text: laserText,
          laser_price: laserTotalPrice,
          laser_duration_min: laserExtraDuration,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409) {
          setToast(data.error || "Bu saat artık dolu. Saatleri yeniliyorum…");
          setPicked("");
          await getSlots();
          return;
        }
        return setToast(data.error || "Randevu oluşturulamadı");
      }

      router.push(`/confirmation/${data.id}`);
        return;
    } finally {
      setBooking(false);
    }
  }

  const fullBodySelected = useMemo(() => {
    return laserSelectedOptions.some((x) => (x.name || "").toLowerCase().includes("tüm vücut"));
  }, [laserSelectedOptions]);

  const canBook = selectedServiceIds.length > 0 && !!date && !!picked && name.trim().length > 0 && phone.trim().length > 0;


  

    const currentStep = useMemo(() => {
      const hasServices = selectedServiceIds.length > 0;
      const needsLaser = !!laserServiceId;
      const laserOk = !needsLaser || selectedLaserOptionIds.length > 0;

      const needsBarber = hairSelected && activeBarbers.length > 1;
      const barberOk = !needsBarber || !!selectedBarberId;

      const hasDate = !!date;
      const hasSlots = slots.length > 0;
      const hasTime = !!picked;

      const hasContact = name.trim().length > 0 && phone.trim().length > 0;

      // 0 Hizmet
      if (!hasServices) return 0;
      // 1 Lazer (varsa)
      if (needsLaser && !laserOk) return 1;
      // 2 Berber (gerekirse)
      if (needsBarber && !barberOk) return 2;
      // 3 Saat seçimi
      if (!hasDate || !hasSlots || !hasTime) return 3;
      // 4 İletişim
      if (!hasContact) return 4;
      // 5 Tamam
      return 5;
    }, [
      selectedServiceIds,
      laserServiceId,
      selectedLaserOptionIds,
      hairSelected,
      activeBarbers,
      selectedBarberId,
      date,
      slots,
      picked,
      name,
      phone,
    ]);

    const steps = [
      "Hizmet",
      laserServiceId ? "Lazer" : null,
      hairSelected && activeBarbers.length > 1 ? "Berber" : null,
      "Saat",
      "Bilgi",
      "Tamamla",
    ].filter(Boolean) as string[];
return (
    <div className="min-h-screen bg-mc-black text-mc-bronze hidden md:inline-flex">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="flex justify-center mb-6">
          <div className="text-center">
            <div className="font-heading text-mc-bronze text-3xl leading-none">Man Cave</div>
            <div className="text-xs text-neutral-400 mt-2">Hair & Skin • Care Center</div>
          </div>
        </div>

        <div className="rounded-2xl bg-white text-black shadow-sm border border-mc-border overflow-hidden">
          <div className="h-1 bg-mc-bronze" />
          <div className="p-6 pb-24 md:pb-6">
    
          <div className="text-xs text-neutral-600 mt-1">
        <div data-step-progress className="mt-2 flex flex-wrap gap-2">
          {steps.map((label, i) => {
            const active = i === currentStep;
            const done = i < currentStep;
            return (
              <div
                key={label}
                className={[
                  "rounded-full border px-3 py-1 text-xs font-semibold transition",
                  done
                    ? "border-mc-bronze/40 bg-mc-bronze/10 text-mc-bronze"
                    : active
                      ? "border-mc-bronze/35 bg-white/10 text-mc-bronze"
                      : "border-mc-border bg-white text-neutral-700",
                ].join(" ")}
              >
                {label}
              </div>
            );
          })}
        </div>



      {toast && (
        <div className="mt-4 rounded-xl border border-mc-bronze/30 bg-white px-4 py-3 text-sm text-mc-dark shadow-sm">
          {toast}
        </div>
      )}


      <div className="mt-3 space-y-3">
        {activeServices.map((s) => {
          const checked = selectedServiceIds.includes(s.id);
          const pillClass = "flex items-center justify-between gap-3 w-full rounded-xl border px-4 py-3 transition cursor-pointer select-none hover:-translate-y-0.5 duration-150 " +
            (checked
              ? "border-mc-bronze bg-mc-black text-mc-bronze shadow-sm"
              : "border-mc-border bg-white text-mc-dark hover:border-mc-bronze hover:shadow-[0_0_0_2px_rgba(192,138,90,0.15)]");

          
          
          return (
            <label key={s.id} className={pillClass}>
<span className="flex items-center gap-3">
                <input
                  type="checkbox" className="sr-only"
                  checked={checked}
                  onChange={(e) => {
                    setSelectedServiceIds((prev) =>
                      e.target.checked ? [...prev, s.id] : prev.filter((x) => x !== s.id)
                    );
                  }}
                />
                <span className="inline-flex items-center gap-2">
                    <span className="w-4 text-mc-bronze">{checked ? "✓" : ""}</span>
                    <span>{s.name}</span>
                  </span>
              </span>

              <span className="text-sm text-neutral-500">
                {s.is_variable_duration
                  ? `${s.min_duration_min ?? 0}–${s.max_duration_min ?? 0} dk`
                  : `${serviceDurationMin(s)} dk`}
              </span>
            </label>
          );
        })}
      </div>

      {laserServiceId && (
        <div className="mt-5 rounded-2xl border border-mc-border bg-white p-4 shadow-sm mc-fade-up">
          <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-mc-bronze" />
                <div className="text-sm font-semibold text-neutral-900">Lazer Bölgesi Seçimi</div>
              </div>
              {fullBodySelected && (
                <div className="text-xs font-semibold text-mc-bronze">Tüm vücut seçili</div>
              )}
            </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {laserOptions.map((o) => {
              const checked = selectedLaserOptionIds.includes(o.id);
              const isFullBody = (o.name || "").toLowerCase().includes("tüm vücut");
              const disabled = fullBodySelected && !isFullBody;

              return (
                <label
                  key={o.id}
                  className={[
                    "relative rounded-2xl border p-4 transition",
                    disabled
                      ? "cursor-not-allowed"
                      : "hover:border-mc-bronze hover:shadow-[0_0_0_2px_rgba(192,138,90,0.10)]",
                    checked
                      ? "border-mc-bronze bg-[rgba(192,138,90,0.06)]"
                      : "border-mc-border bg-white",
                  ].join(" ")}
                >
                  {disabled && (
                    <>
                      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-neutral-200/35" />
                      <div className="pointer-events-none absolute right-3 top-3 rounded-full border border-mc-bronze/30 bg-mc-bronze/15 px-2 py-0.5 text-[11px] font-semibold text-mc-bronze backdrop-blur">
                        Kilitli
                      </div>
                    </>
                  )}
                  <span className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={(e) => {
                        setSelectedLaserOptionIds((prev) => {
                          if (isFullBody) return e.target.checked ? [o.id] : [];
                          if (fullBodySelected) return prev;
                          return e.target.checked ? [...prev, o.id] : prev.filter((x) => x !== o.id);
                        });
                      }}
                    />
                    <span className={["font-semibold", disabled ? "text-neutral-800" : "text-neutral-900"].join(" ")}>{o.name}</span>
                  </span>

                  <span className="text-sm text-neutral-700">
                    {o.price} TL • {o.duration_min} dk
                  </span>
                </label>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-mc-bronze/30 bg-[rgba(192,138,90,0.08)] px-4 py-3">
              <div className="text-sm font-medium text-neutral-900">Toplam Lazer</div>
              <div className="text-sm text-neutral-900">
                <b>{laserTotalPrice} TL</b>
                <span className="text-neutral-600"> • </span>
                <b>{laserExtraDuration} dk</b>
              </div>
            </div>
        </div>
      )}

  {waLink && (
    <div className="mt-3 rounded-xl border border-mc-border bg-neutral-50 px-4 py-3">
      <button
        onClick={() => {
          window.open(waLink, "_blank");
          setWaLink("");
        }}
        className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm bg-mc-black text-mc-bronze border border-mc-bronze hover:bg-mc-bronze hover:text-black transition"
      >
        Ödeme için WhatsApp Mesajı Gönder
      </button>
      <div className="mt-1 text-xs text-neutral-600">Butona basınca ödeme mesajı işletmeye gider.</div>
    </div>
  )}

      {hairSelected && activeBarbers.length > 1 && (
          <>
            <h2 className="mt-8 text-xl font-semibold">Berber seç</h2>
            <BarberSelectModal />
          </>
        )}

      <h2 className="mt-8 text-xl font-semibold">Tarih</h2>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          type="date"
          className="rounded-xl border px-3 py-2"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />

        <button
          onClick={getSlots}
          disabled={loadingSlots}
          className="rounded-xl px-6 py-3 bg-mc-black text-mc-bronze border border-mc-bronze hover:bg-mc-bronze hover:text-black transition"
        >
          {loadingSlots ? "Kontrol ediliyor…" : "Uygun Saatleri Göster"}
        </button>

        <span className="text-sm text-neutral-500">Toplam süre: {totalDurationMin} dk</span>
      </div>

      {slots.length > 0 && (
        <>
          
            <div className="mt-6 flex items-center justify-between">
              <h3 className="font-medium">Uygun Saatler</h3>
              <div className="text-xs text-neutral-500">{filteredSlots.length} seçenek</div>
            </div>

            {(() => {
              const toMin = (t: string) => {
                const [h, m] = t.split(":").map(Number);
                return h * 60 + m;
              };

              const morning = filteredSlots.filter((t) => toMin(t) < 12 * 60);
              const noon = filteredSlots.filter((t) => toMin(t) >= 12 * 60 && toMin(t) < 17 * 60);
              const evening = filteredSlots.filter((t) => toMin(t) >= 17 * 60);

              const list =
                timeTab === "morning" ? morning : timeTab === "noon" ? noon : evening;

              const tabBtn = (key: "morning" | "noon" | "evening", label: string, count: number) => (
                <button
                  type="button"
                  onClick={() => setTimeTab(key)}
                  className={[
                    "flex-1 rounded-xl px-3 py-2 text-[13px] font-semibold transition active:scale-[0.99]",
                    timeTab === key
                      ? "bg-mc-black text-mc-bronze border border-mc-bronze"
                      : "bg-neutral-100 text-neutral-800 hover:bg-neutral-200",
                  ].join(" ")}
                >
                  {label}
                  <span className="ml-2 text-[11px] font-medium opacity-70">({count})</span>
                </button>
              );

              return (
                <div className="mt-3 rounded-2xl border border-mc-border bg-white p-3 mc-fade-up">
                  <div className="flex gap-2">
                    {tabBtn("morning", "Sabah", morning.length)}
                    {tabBtn("noon", "Öğle", noon.length)}
                    {tabBtn("evening", "Akşam", evening.length)}
                  </div>

                  <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {list.length === 0 ? (
                      <div className="w-full rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-4 text-sm text-neutral-600">
                        Bu aralıkta uygun saat yok.
                      </div>
                    ) : (
                      list.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setPicked(t)}
                          className={slotBtnClass(t)}
                        >
                          {t}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              );
            })()}


          {picked && previewSegments.length > 0 && (
            <div
              ref={previewRef}
              className={[
                "mt-4 rounded-xl border bg-neutral-50 p-4 transition-all duration-200 mc-fade-up",
                showPreview ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1",
              ].join(" ")}
            >
              <div className="text-sm font-semibold">Tahmini Akış</div>
              <div className="mt-2 space-y-2">
                {previewSegments.map((seg, i) => (
                  <div
                    key={`${seg.name}-${i}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white border p-2 text-sm"
                  >
                    <div className="font-medium">{seg.name}</div>
                    <div className="text-neutral-700">
                      {seg.start} – {seg.end}
                    </div>
                    <div className="text-xs text-neutral-500">{seg.resource}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className="mt-6 space-y-3 mc-pop">
        <input
          placeholder="Ad Soyad"
          className="w-full rounded-xl border px-3 py-3 focus:outline-none focus:ring-2 focus:ring-mc-bronze/40 focus:border-mc-bronze"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          placeholder="Telefon"
          className="w-full rounded-xl border px-3 py-3 focus:outline-none focus:ring-2 focus:ring-mc-bronze/40 focus:border-mc-bronze"
          value={phone}
          onChange={(e) => {
            const v = e.target.value;
            const cleaned = v.startsWith("+")
              ? "+" + v.slice(1).replace(/[^0-9]/g, "")
              : v.replace(/[^0-9]/g, "");
            setPhone(cleaned);
          }}
        />
      </div>

      <button
        onClick={book}
        disabled={booking}
        className="mt-5 hidden md:inline-flex w-full md:w-auto rounded-xl px-6 py-3 bg-mc-black text-mc-bronze border border-mc-bronze hover:bg-mc-bronze hover:text-black transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {booking ? "Oluşturuluyor…" : "Randevuyu Tamamla"}
      </button>
    </div>
          </div>
        </div>
      </div>

      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-mc-border p-4">
        <div className="mb-3 flex items-center justify-between text-xs text-neutral-600">
          <span>Toplam süre: <span className="font-medium text-neutral-900">{totalDurationMin} dk</span></span>
          {laserTotalPrice > 0 && (
            <span>Toplam: <span className="font-medium text-neutral-900">{laserTotalPrice} TL</span></span>
          )}
        </div>

        <button
          onClick={book}
          disabled={!canBook || booking}
          className="w-full md:w-auto rounded-xl px-6 py-3 bg-mc-black text-mc-bronze border border-mc-bronze hover:bg-mc-bronze hover:text-black transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {booking ? "Oluşturuluyor…" : "Randevuyu Tamamla"}
        </button>
      </div>

    </div>
  );
}

