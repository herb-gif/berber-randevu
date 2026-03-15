"use client";

import { useEffect, useMemo, useState } from "react";
import AdminNavTabs from "../ui/AdminNavTabs";

type Service = {
  id: string;
  name: string;
  is_active: boolean;
  service_type: string;
  resource_group?: string | null;
};

type Barber = {
  id: string;
  name: string;
  is_active: boolean;
};

type SlotRow = {
  time: string;
  status: "available" | "booked" | "blocked" | "outside_hours";
  label: string;
  blockId?: string;
};

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

function slotClass(status: SlotRow["status"], selected: boolean) {
  const base =
    "rounded-2xl border px-3 py-3 text-sm font-medium transition text-left shadow-sm";
  const ring = selected ? " ring-2 ring-mc-bronze/40" : "";

  if (status === "available") {
    return `${base} border-emerald-400/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15${ring}`;
  }
  if (status === "booked") {
    return `${base} border-rose-400/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/15${ring}`;
  }
  if (status === "blocked") {
    return `${base} border-mc-bronze/40 bg-[rgba(192,138,90,0.10)] text-mc-bronze hover:bg-[rgba(192,138,90,0.16)]${ring}`;
  }
  return `${base} border-white/10 bg-neutral-900 text-white/35 hover:bg-neutral-900${ring}`;
}

export default function AdminSchedulerPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [date, setDate] = useState<string>("");
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedBarberId, setSelectedBarberId] = useState<string>("");

  const [blockDurationMin, setBlockDurationMin] = useState<number>(60);
  const [blockReason, setBlockReason] = useState<string>("mola");
  const [blockNote, setBlockNote] = useState<string>("");
  const [savingBlock, setSavingBlock] = useState(false);

  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [toast, setToast] = useState("");

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

  const activeServices = useMemo(
    () => (services || []).filter((s) => s.is_active),
    [services]
  );

  const activeBarbers = useMemo(
    () => (barbers || []).filter((b) => b.is_active),
    [barbers]
  );

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

  async function removeBlockFromScheduler() {
    if (!selectedSlotRow?.blockId) return setToast("Blok bulunamadı");

    setSavingBlock(true);
    try {
      const res = await fetch(`/api/admin/blocks/${selectedSlotRow.blockId}`, {
        method: "DELETE",
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        return setToast(data.error || "Blok kaldırılamadı");
      }

      setToast("Blok kaldırıldı ✅");
      await loadSlots();
    } finally {
      setSavingBlock(false);
    }
  }

  async function loadSlots() {
    if (!date) return setToast("Tarih seç");
    if (selectedServiceIds.length === 0) return setToast("Hizmet seç");
    if (hairSelected && !selectedBarberId) return setToast("Berber seç");

    setLoadingSlots(true);
    setSelectedSlot("");

    try {
      const q = new URLSearchParams();
      q.set("date", date);
      q.set("serviceIds", selectedServiceIds.join(","));
      if (hairSelected) q.set("barberId", selectedBarberId);

      const res = await fetch(`/api/admin/scheduler-slots?${q.toString()}`, {
        cache: "no-store",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        return setToast(data.error || "Slotlar alınamadı");
      }

      setSlots(data.slots ?? []);
    } finally {
      setLoadingSlots(false);
    }
  }

  const selectedSlotRow = useMemo(
    () => slots.find((s) => s.time === selectedSlot) || null,
    [slots, selectedSlot]
  );


  async function createBlockFromScheduler() {
    if (!date) return setToast("Tarih seç");
    if (!selectedSlotRow) return setToast("Slot seç");
    if (selectedSlotRow.status !== "available") {
      if (selectedSlotRow.status === "booked") return setToast("Dolu slot bloklanamaz");
      if (selectedSlotRow.status === "blocked") return setToast("Bu slot zaten bloklu");
      return setToast("Mesai dışı slot bloklanamaz");
    }
    if (hairSelected && !selectedBarberId) return setToast("Berber seç");

    setSavingBlock(true);
    try {
      const res = await fetch("/api/admin/blocks", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          time: selectedSlotRow.time,
          duration_min: blockDurationMin,
          resource: hairSelected
            ? "hair"
            : (selectedServices.some((s) => (s.resource_group || "").toLowerCase() === "niyazi")
                ? "niyazi"
                : "external"),
          barber_id: hairSelected ? selectedBarberId : null,
          reason: blockReason,
          note: blockNote,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return setToast(data.error || "Blok oluşturulamadı");
      }

      setToast("Saat bloğu eklendi ✅");
      setBlockNote("");
      await loadSlots();
    } finally {
      setSavingBlock(false);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-950 p-6 text-neutral-100">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-heading text-mc-bronze">Admin Scheduler</h1>
            <div className="mt-1 text-sm text-white/60">
              Airbnb tarzı hızlı planlama görünümü
            </div>
          </div>

          <div className="flex items-center gap-2">
            <AdminNavTabs />
            <a
              href="/admin"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-neutral-100 hover:border-mc-bronze transition"
            >
              Admin Panel
            </a>
          </div>
        </div>

        {toast && (
          <div className="rounded-xl border border-mc-bronze/30 bg-[rgba(192,138,90,0.10)] px-4 py-3 text-sm text-neutral-100 shadow-sm">
            {toast}
          </div>
        )}

        {!loaded && (
          <div className="rounded-2xl border border-white/10 bg-neutral-900 p-4 text-sm text-white/60">
            Yükleniyor…
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-neutral-900 p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <div>
              <div className="text-sm font-semibold text-neutral-100">Tarih</div>
              <input
                type="date"
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <div className="text-sm font-semibold text-neutral-100">Hizmet</div>
              <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-2">
                <div className="flex flex-wrap gap-2">
                  {activeServices.map((s) => {
                    const checked = selectedServiceIds.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() =>
                          setSelectedServiceIds((prev) =>
                            checked ? prev.filter((x) => x !== s.id) : [...prev, s.id]
                          )
                        }
                        className={`rounded-full border px-3 py-1.5 text-xs transition ${
                          checked
                            ? "border-mc-bronze bg-mc-bronze/10 text-mc-bronze"
                            : "border-white/10 bg-neutral-900 text-white/70 hover:bg-neutral-800"
                        }`}
                      >
                        {s.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold text-neutral-100">Berber</div>
              <select
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                value={selectedBarberId}
                onChange={(e) => setSelectedBarberId(e.target.value)}
                disabled={!hairSelected}
              >
                <option value="">{hairSelected ? "Seçiniz" : "Hair servis seçin"}</option>
                {activeBarbers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="text-sm font-semibold text-neutral-100">Amaç</div>
              <div className="mt-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70">
                Boş slotu hızlıca blokla
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={loadSlots}
              disabled={loadingSlots}
              className="rounded-xl border border-mc-bronze bg-mc-black px-4 py-2 text-sm text-mc-bronze hover:bg-mc-bronze hover:text-neutral-100 transition disabled:opacity-50"
            >
              {loadingSlots ? "Yükleniyor…" : "Slotları Göster"}
            </button>

            <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-neutral-900 px-3 py-1 text-white/70">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400" />
                Müsait
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-neutral-900 px-3 py-1 text-white/70">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-400" />
                Dolu
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-neutral-900 px-3 py-1 text-white/70">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-[rgb(192,138,90)]" />
                Bloklu
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-neutral-900 px-3 py-1 text-white/70">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-neutral-600" />
                Mesai Dışı
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
          <div className="rounded-2xl border border-white/10 bg-neutral-900 p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-neutral-100">Saat Grid</div>
                <div className="text-xs text-white/50">
                  Slot seçimi ile hızlı planlama
                </div>
              </div>
              <div className="text-xs text-white/50">
                {slots.length ? `${slots.length} slot` : "Henüz yüklenmedi"}
              </div>
            </div>

            {slots.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white/50">
                Tarih, hizmet ve gerekirse berber seçip slotları yükleyin.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
                {slots.map((slot) => (
                  <button
                    key={slot.time}
                    type="button"
                    onClick={() => setSelectedSlot(slot.time)}
                    className={slotClass(slot.status, selectedSlot === slot.time)}
                  >
                    <div className="text-base font-semibold">{slot.time}</div>
                    <div className="mt-1 text-xs opacity-80">{slot.label}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-neutral-900 p-4 shadow-sm">
            <div className="text-sm font-semibold text-neutral-100">Seçili Slot</div>
            {!selectedSlotRow ? (
              <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/50">
                Grid’den bir slot seçin.
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs text-white/50">Saat</div>
                  <div className="mt-1 text-lg font-semibold text-neutral-100">
                    {selectedSlotRow.time}
                  </div>
                  <div className="mt-1 text-sm text-white/60">{selectedSlotRow.label}</div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs text-white/50">Mod</div>
                  <div className="mt-1 text-sm font-medium text-neutral-100">Hızlı Saat Kapatma</div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs text-white/50">Süre</div>
                  <select
                    className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
                    value={String(blockDurationMin)}
                    onChange={(e) => setBlockDurationMin(Number(e.target.value))}
                  >
                    <option value="30">30 dk</option>
                    <option value="60">60 dk</option>
                    <option value="90">90 dk</option>
                    <option value="120">120 dk</option>
                  </select>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs text-white/50">Sebep</div>
                  <select
                    className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                  >
                    <option value="mola">Mola</option>
                    <option value="ozel_is">Özel İş</option>
                    <option value="aile">Aile</option>
                    <option value="kisisel">Kişisel</option>
                    <option value="kapali">Kapalı</option>
                    <option value="diger">Diğer</option>
                  </select>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs text-white/50">Not</div>
                  <textarea
                    className="mt-2 min-h-[96px] w-full rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
                    value={blockNote}
                    onChange={(e) => setBlockNote(e.target.value)}
                    placeholder="Örn: öğle arası, özel iş, dışarıda olacağım"
                  />
                </div>

                {selectedSlotRow?.status === "blocked" ? (
                  <button
                    type="button"
                    onClick={removeBlockFromScheduler}
                    disabled={savingBlock || !selectedSlotRow?.blockId}
                    className="w-full rounded-xl border border-rose-400/40 bg-neutral-950 px-4 py-3 text-sm font-medium text-rose-300 hover:bg-rose-500/10 transition disabled:opacity-50"
                  >
                    {savingBlock ? "İşleniyor…" : "Bloğu Kaldır"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={createBlockFromScheduler}
                    disabled={
                      savingBlock ||
                      !selectedSlotRow ||
                      selectedSlotRow.status !== "available" ||
                      (hairSelected && !selectedBarberId)
                    }
                    className="w-full rounded-xl border border-mc-bronze bg-mc-black px-4 py-3 text-sm font-medium text-mc-bronze hover:bg-mc-bronze hover:text-neutral-100 transition disabled:opacity-50"
                  >
                    {savingBlock ? "Kaydediliyor…" : "Saati Kapat"}
                  </button>
                )}

                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs text-white/50">Durum notu</div>
                  <div className="mt-1 text-sm text-white/70">
                    {selectedSlotRow.status === "available"
                      ? "Bu slot bloklanabilir."
                      : selectedSlotRow.status === "booked"
                        ? "Bu slot dolu olduğu için bloklanamaz."
                        : selectedSlotRow.status === "blocked"
                          ? "Bu slot zaten bloklu. İstersen kaldırabilirsin."
                          : "Bu slot mesai dışı."}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
