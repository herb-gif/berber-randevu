"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { buildDepositPaymentMessage, buildApprovalMessage, buildReminderMessage, buildWhatsAppWebUrl } from "@/lib/whatsapp";
import { useRouter, useSearchParams } from "next/navigation";
import { DISPLAY_TZ } from "@/lib/timezone";

type Block = {
  resource: "hair" | "niyazi" | "external" | string;
  sort_order: number;
  start_at: string;
  end_at: string;
  status: string;
  service_id: string;
  service_name: string | null;
  service_type: string | null;
  barber_id: string | null;
  barber_name: string | null;
};

type Row = {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_phone_e164?: string | null;
  customer_phone_raw?: string | null;
  start_at: string;
  end_at: string;
  status: string;
  created_at: string;
  deposit_status?: string | null;
  deposit_amount?: number | null;
  total_price?: number | null;
  cancel_reason?: string | null;
  service_summary?: string | null;
  blocks: Block[];
};

type Payment = {
  bank_name: string;
  iban: string;
  account_name?: string | null;
  note?: string | null;
  whatsapp_phone_e164?: string | null;
};

type AdminBlockRow = {
  id: string;
  resource: "hair" | "niyazi" | "external" | string;
  barber_id?: string | null;
  barber_name?: string | null;
  start_at: string;
  end_at: string;
  reason?: string | null;
  note?: string | null;
  is_active: boolean;
  created_at: string;
};

const TZ = DISPLAY_TZ;
const dtf = new Intl.DateTimeFormat("tr-TR", { timeZone: TZ, dateStyle: "short", timeStyle: "short" });
const tf = new Intl.DateTimeFormat("tr-TR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

function fmtDT(iso: string) {
  try { return dtf.format(new Date(iso)); } catch { return iso; }
}
function fmtT(iso: string) {
  try { return tf.format(new Date(iso)); } catch { return iso; }
}
function digitsOnly(x: string) {
  return (x || "").replace(/[^0-9]/g, "");
}
function waUrl(phone: string, text: string) {
  return buildWhatsAppWebUrl(phone, text);
}

function depLabel(s?: string | null) {
  const v = (s || "").toLowerCase();
  if (v === "paid") return "Ödendi";
  if (v === "pending") return "Bekliyor";
  if (v === "required") return "Zorunlu";
  if (v === "forfeited") return "Yandı";
    if (v === "refunded") return "İade Edildi";
  if (v === "cancelled") return "İptal";
  return s ?? "—";
}
function depBadgeClass(s?: string | null) {
  const v = (s || "").toLowerCase();
  if (v === "paid") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  if (v === "forfeited") return "bg-rose-500/10 text-rose-400 border-rose-500/20";
    if (v === "refunded") return "bg-blue-500/10 text-blue-400 border-blue-500/20";
  if (v === "required") return "bg-amber-500/10 text-amber-400 border-amber-500/20";
  if (v === "pending") return "bg-neutral-800/40 text-neutral-300 border-neutral-700";
  if (v === "cancelled") return "bg-neutral-800/40 text-neutral-400 border-neutral-700";
  return "bg-neutral-800/40 text-neutral-300 border-neutral-700";
}
function cancelReasonLabel(r?: string | null) {
  if (!r) return null;
  if (r === "admin") return "🔴 Admin iptal";
  if (r === "auto_no_deposit") return "🟠 Otomatik iptal";
  if (r === "customer") return "⚪ Müşteri iptal";
  if (r === "unknown") return "⚫ İptal";
  return `⚫ ${r}`;
}

async function fetchPayment(): Promise<Payment | null> {
  const res = await fetch("/api/admin/payment", { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return null;
  return data.payment ?? null;
}



function rowClass(r: Row) {
    const status = String(r.status || "").toLowerCase();
    const dep = String(r.deposit_status || "").toLowerCase().trim();

    // Dark-ish "signal strip" (minimal diff): keep row mostly neutral, signal via left border.
    if (status === "no_show") return "border-t align-top border-l-4 border-rose-300";
    if (status === "cancelled") return "border-t align-top border-l-4 border-neutral-200 text-white/50";

    if (dep === "refunded") return "border-t align-top border-l-4 border-blue-300";
    if (dep === "forfeited") return "border-t align-top border-l-4 border-rose-200";
    if (dep === "paid") return "border-t align-top border-l-4 border-emerald-300";

    if (dep === "pending" || dep === "required") return "border-t align-top border-l-4 border-amber-300";

    return "border-t align-top border-l-4 border-transparent";
}

function minutesBetween(a: string, b: string) {
  const x = Date.parse(a);
  const y = Date.parse(b);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return 0;
  return Math.max(0, Math.round((y - x) / 60000));
}

function blockReasonLabel(v?: string | null) {
  const x = String(v || "").toLowerCase().trim();
  if (!x) return "Blok";
  if (x === "mola") return "Mola";
  if (x === "ozel_is") return "Özel İş";
  if (x === "aile") return "Aile";
  if (x === "kisisel") return "Kişisel";
  if (x === "kapali") return "Kapalı";
  if (x === "diger") return "Diğer";
  return v ?? "Blok";
}

function blockResourceLabel(resource?: string | null, barberName?: string | null) {
  const x = String(resource || "").toLowerCase().trim();
  if (x === "hair") return barberName ? `Berber: ${barberName}` : "Berber";
  if (x === "niyazi") return "Niyazi";
  if (x === "external") return "Harici";
  return resource ?? "—";
}

export default function AdminDashboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [blocks, setBlocks] = useState<AdminBlockRow[]>([]);
  const [toast, setToast] = useState<string>("");
  const [lastRefreshAt, setLastRefreshAt] = useState<string>("");
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [blocksLoading, setBlocksLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
    const [filterQ, setFilterQ] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");
    const [filterDep, setFilterDep] = useState("all");

    
      const [filterWhen, setFilterWhen] = useState("all");
const router = useRouter();
    const searchParams = useSearchParams();
    const didInitFiltersRef = useRef(false);
    const tableTopRef = useRef<HTMLDivElement | null>(null);
    const [waMenuId, setWaMenuId] = useState<string | null>(null);

  
      const [actionMenuId, setActionMenuId] = useState<string | null>(null);
async function load() {
    setLoading(true);
    const res = await fetch(`/api/admin/appointments?days=${days}`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoading(false);
      alert(data.error || "Randevular alınamadı");
      return;
    }
    setRows(data.rows ?? []);
    setLoading(false);
  }

  async function loadBlocks() {
    setBlocksLoading(true);
    try {
      const res = await fetch(`/api/admin/blocks?days=${days}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "Bloklar alınamadı");
        return;
      }
      const next = [...(data.rows ?? [])].sort(
        (a, b) => Date.parse(a.start_at) - Date.parse(b.start_at)
      );
      setBlocks(next);
    } finally {
      setBlocksLoading(false);
    }
  }

  async function removeBlock(id: string) {
    if (!confirm("Bu blok kaldırılsın mı?")) return;

    const res = await fetch(`/api/admin/blocks/${id}`, {
      method: "DELETE",
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return alert(data.error || "Blok kaldırılamadı");

    setBlocks((prev) => (prev || []).filter((b) => b.id !== id));
    setToast("Blok kaldırıldı ✅");
    load();
    loadBlocks();
  }

  useEffect(() => { load(); loadBlocks(); /* eslint-disable-next-line */ }, [days]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      load();
      loadBlocks();
    };

    const id = window.setInterval(tick, 30000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

    useEffect(() => {
      if (didInitFiltersRef.current) return;
      didInitFiltersRef.current = true;

      const q = searchParams.get("q") || "";
      const st = searchParams.get("status") || "all";
      const dep = searchParams.get("dep") || "all";

      
        const when = searchParams.get("when") || "all";
setFilterQ(q);
      setFilterStatus(st);
      setFilterDep(dep);
      
        setFilterWhen(when);
// eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    useEffect(() => {
      // State -> URL
      const params = new URLSearchParams(searchParams.toString());

      if (filterQ) params.set("q", filterQ);
      else params.delete("q");

      if (filterStatus !== "all") params.set("status", filterStatus);
      else params.delete("status");

      if (filterDep !== "all") params.set("dep", filterDep);
      else params.delete("dep");

      
        if (filterWhen !== "all") params.set("when", filterWhen);
        else params.delete("when");
const qs = params.toString();
      router.replace(qs ? `/admin?${qs}` : "/admin");
      // eslint-disable-next-line react-hooks/exhaustive-deps

}, [filterQ, filterStatus, filterDep, filterWhen]);

    useEffect(() => {
      // Filtre değişince tabloya kaydır
      tableTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterQ, filterStatus, filterDep, filterWhen]);






    useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
      function handleClick(e: MouseEvent) {
        const t = e.target as HTMLElement;
        if (!t.closest(".wa-dropdown")) setWaMenuId(null);
          if (!t.closest(".action-dropdown")) setActionMenuId(null);
      }
      document.addEventListener("click", handleClick);
      return () => document.removeEventListener("click", handleClick);
    }, []);


  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime());

    return copy;
  }, [rows]);


  const todaySummary = useMemo(() => {
    const todayKey = new Date().toLocaleDateString("en-CA", { timeZone: TZ });

    const todayRows = (rows || []).filter(
      (r) =>
        new Date(r.start_at).toLocaleDateString("en-CA", { timeZone: TZ }) === todayKey
    );

    const todayCount = todayRows.length;

    const todayRevenue = todayRows.reduce(
      (sum, r) => sum + (typeof r.total_price === "number" ? r.total_price : 0),
      0
    );

    const pendingDepositCount = todayRows.filter((r) => {
      const dep = String(r.deposit_status || "").toLowerCase().trim();
      return dep === "pending" || dep === "required";
    }).length;

    const noShowCount = todayRows.filter(
      (r) => String(r.status || "").toLowerCase() === "no_show"
    ).length;

    return { todayCount, todayRevenue, pendingDepositCount, noShowCount };
  }, [rows]);


    const viewRows = useMemo(() => {
      const q = filterQ.trim().toLowerCase();

      

        const todayKey = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
        const tomorrowKey = new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString("en-CA", { timeZone: TZ });
        const weekEndKey = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString("en-CA", { timeZone: TZ });
return (sortedRows || []).filter((r) => {
        const st = String(r.status || "").toLowerCase();
        const dep = String(r.deposit_status || "").toLowerCase().trim();

        if (filterStatus !== "all" && st !== filterStatus) return false;
        if (filterDep !== "all") {
          if (filterDep === "pending_required") {
            if (!(dep === "pending" || dep === "required")) return false;
          } else {
            if (dep !== filterDep) return false;
          }
        }
          // Tarih preset filtresi
          const dayKey = new Date(r.start_at).toLocaleDateString("en-CA", { timeZone: TZ });
          if (filterWhen === "today" && dayKey !== todayKey) return false;
          if (filterWhen === "tomorrow" && dayKey !== tomorrowKey) return false;
          if (filterWhen === "week") {
            if (dayKey < todayKey || dayKey > weekEndKey) return false;
          }



        if (!q) return true;

        const hay = [
          r.customer_name,
          r.customer_phone_e164 || r.customer_phone,
          r.service_summary || "",
        ]
          .join(" ")
          .toLowerCase();

        return hay.includes(q);
      });
    }, [sortedRows, filterQ, filterStatus, filterDep, filterWhen]);

  async function cancel(id: string) {
      if (!confirm("Randevu iptal edilsin mi?")) return;

      const res = await fetch("/api/admin/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) return alert(data.error || "İptal edilemedi");

      setRows((prev) =>
        (prev || []).map((r) => {
          if (r.id !== id) return r;
          const dep = String(r.deposit_status || "").toLowerCase().trim();
          const paidSet = new Set(["paid", "odendi", "ödendi", "completed", "confirmed"]);
          return {
            ...r,
            status: "cancelled",
            deposit_status: paidSet.has(dep) ? "refunded" : r.deposit_status,
            cancel_reason: "admin",
          };
        })
      );
      load();
      loadBlocks();
    }


  async function markÖdendi(id: string) {
      const res = await fetch("/api/admin/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "mark_paid" }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) return alert(data.error || "Depozito güncellenemedi");

      setRows((prev) => (prev || []).map((r) => (r.id === id ? { ...r, deposit_status: "paid" } : r)));
      load();
      loadBlocks();
    }

    async function markNoShow(id: string) {
      const res = await fetch("/api/admin/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "no_show" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return alert(data.error || "No-show işaretlenemedi");

      // Optimistic UI update
      setRows((prev) =>
        (prev || []).map((r) => {
          if (r.id !== id) return r;
          const dep = String(r.deposit_status || "").toLowerCase().trim();
          const paidSet = new Set(["paid", "odendi", "ödendi", "completed", "confirmed"]);
          return {
            ...r,
            status: "no_show",
            deposit_status: paidSet.has(dep) ? "forfeited" : r.deposit_status,
          };
        })
      );
      load();
      loadBlocks();
    }



  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    location.reload();
  }

  return (    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 text-neutral-100 p-6 shadow-sm">
      {toast && (
        <div className="mb-4 rounded-xl border border-mc-bronze/30 bg-[rgba(192,138,90,0.10)] px-4 py-3 text-sm text-neutral-100 shadow-sm">
          {toast}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg md:text-xl font-semibold">Admin Panel</h1>
          <div className="hidden md:block text-sm text-white/60">Randevular + depozito + WhatsApp mesaj</div>
          {lastRefreshAt && (
            <div className="mt-1 text-xs text-white/40">Son güncelleme: {lastRefreshAt}</div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select className={`relative rounded-xl border border-white/10 bg-neutral-900 px-4 py-2 pr-10 text-sm text-neutral-100 hover:bg-neutral-800 hover:border-mc-bronze transition`} value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={1}>1 gün</option>
            <option value={7}>7 gün</option>
            <option value={14}>14 gün</option>
            <option value={30}>30 gün</option>
            <option value={60}>60 gün</option>
          </select>

          <button onClick={load} className="rounded-xl border border-white/10 bg-neutral-900 px-4 py-2 text-sm text-neutral-100 hover:border-mc-bronze transition text-neutral-100 text-neutral-100">Yenile</button>
          <button onClick={logout} className="rounded-lg bg-black px-3 py-2 text-white">Çıkış</button>
        </div>
      </div>

      
        {/* Summary Cards */}
        <div className="hidden md:grid mt-6 grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
          <div className="rounded-2xl border border-white/10 bg-neutral-900 p-3 md:p-4 shadow-sm cursor-pointer hover:bg-neutral-800 transition text-neutral-100" onClick={() => { setFilterWhen("today"); }}>
            <div className="text-xs text-white/50">Bugünkü Randevu</div>
            <div className="mt-1 text-2xl font-semibold">{todaySummary.todayCount}</div>
          </div>



          <div className="rounded-2xl border border-white/10 bg-neutral-900 p-3 md:p-4 shadow-sm cursor-pointer hover:bg-neutral-800 transition text-neutral-100" onClick={() => { setFilterWhen("today"); setFilterDep("pending_required"); }}>
            <div className="text-xs text-white/50">Bekleyen Depozito</div>
            <div className="mt-1 text-2xl font-semibold">{todaySummary.pendingDepositCount}</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-neutral-900 p-3 md:p-4 shadow-sm cursor-pointer hover:bg-neutral-800 transition text-neutral-100" onClick={() => { setFilterWhen("today"); setFilterStatus("no_show"); }}>
            <div className="text-xs text-white/50">Bugünkü No-show</div>
            <div className="mt-1 text-2xl font-semibold">{todaySummary.noShowCount}</div>
          </div>
        </div>

        {/* Filtreler */}
          <div className="hidden md:block mt-4 rounded-2xl border border-white/10 bg-neutral-900/90 p-2 md:p-3 shadow-sm text-neutral-100 sticky top-16 z-20 backdrop-blur">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <button
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    filterWhen === "today"
                      ? "border-mc-bronze bg-mc-bronze/10 text-mc-bronze"
                      : "border-white/10 bg-neutral-900 text-white/70 hover:bg-neutral-800"
                  }`}
                  onClick={() => setFilterWhen(filterWhen === "today" ? "all" : "today")}
                >
                  Bugün
                </button>
                <button
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    filterWhen === "tomorrow"
                      ? "border-mc-bronze bg-mc-bronze/10 text-mc-bronze"
                      : "border-white/10 bg-neutral-900 text-white/70 hover:bg-neutral-800"
                  }`}
                  onClick={() => setFilterWhen(filterWhen === "tomorrow" ? "all" : "tomorrow")}
                >
                  Yarın
                </button>
                <button
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    filterWhen === "week"
                      ? "border-mc-bronze bg-mc-bronze/10 text-mc-bronze"
                      : "border-white/10 bg-neutral-900 text-white/70 hover:bg-neutral-800"
                  }`}
                  onClick={() => setFilterWhen(filterWhen === "week" ? "all" : "week")}
                >
                  Bu hafta
                </button>
              </div>

              <div className="flex-1">
                <div className="text-xs text-white/50">Arama</div>
                <input
                  value={filterQ}
                  onChange={(e) => setFilterQ(e.target.value)}
                  placeholder="İsim / telefon / hizmet…"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mc-bronze/30 focus:border-mc-bronze"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <div>
                  <div className="text-xs text-white/50">Durum</div>
                  <select
                    className="mt-1 rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-sm"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                  >
                    <option value="all">Hepsi</option>
                    <option value="booked">Onaylandı</option>
                    <option value="cancelled">İptal</option>
                    <option value="no_show">No-show</option>
                  </select>
                </div>

                <div>
                  <div className="text-xs text-white/50">Depozito</div>
                  <select
                    className="mt-1 rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-sm"
                    value={filterDep}
                    onChange={(e) => setFilterDep(e.target.value)}
                  >
                    <option value="all">Hepsi</option>
                    <option value="pending_required">Bekliyor + Zorunlu</option>
                    <option value="pending">Bekliyor</option>
                    <option value="required">Zorunlu</option>
                    <option value="paid">Ödendi</option>
                    <option value="refunded">İade</option>
                    <option value="forfeited">Yandı</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    className="mt-1 rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 hover:border-mc-bronze transition"
                    onClick={() => {
                      setFilterQ("");
                      setFilterStatus("all");
                      setFilterDep("all");
                      setFilterWhen("all");
                    }}
                  >
                    Temizle
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-2 text-xs text-white/50">
              Gösterilen: <span className="font-medium text-neutral-100">{viewRows.length}</span>
            </div>
          </div>

          <div ref={tableTopRef} />

          <div className="mt-4 rounded-2xl border border-white/10 bg-neutral-900/90 p-3 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-neutral-100">Aktif Bloklar</div>
                <div className="text-xs text-white/50">Mola, özel iş ve kapatılan saatler</div>
              </div>
              <div className="text-xs text-white/50">
                {blocksLoading ? "Yükleniyor…" : `${blocks.length} blok`}
              </div>
            </div>

            {blocksLoading ? (
              <div className="mt-3 text-sm text-white/50">Bloklar yükleniyor…</div>
            ) : blocks.length === 0 ? (
              <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/60">
                Aktif blok yok.
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-1 gap-2">
                {blocks.map((b) => (
                  <div
                    key={b.id}
                    className="rounded-xl border border-white/10 bg-neutral-950/80 p-3 text-sm text-neutral-100"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="font-semibold">
                          {fmtT(b.start_at)} – {fmtT(b.end_at)}
                        </div>
                        <div className="mt-1 text-xs text-white/50">
                          {(b.start_at || "").slice(0, 10)}
                          {" • "}
                          {blockResourceLabel(b.resource, b.barber_name)}
                          {b.reason ? ` • ${blockReasonLabel(b.reason)}` : ""}
                        </div>
                        {b.note && (
                          <div className="mt-2 text-xs text-white/70">{b.note}</div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center rounded-full border border-mc-bronze/30 bg-mc-bronze/10 px-2 py-1 text-[11px] text-mc-bronze">
                          Blok
                        </span>
                        <button
                          type="button"
                          onClick={() => removeBlock(b.id)}
                          className="rounded-lg border border-white/10 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-100 hover:border-rose-400 hover:text-rose-300 transition"
                        >
                          Bloğu Kaldır
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <a
            href="/admin/manual-appointment"
            className="md:hidden fixed bottom-5 right-5 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full border border-mc-bronze bg-mc-black text-2xl text-mc-bronze shadow-[0_8px_30px_rgba(0,0,0,0.35)] hover:bg-mc-bronze hover:text-neutral-100 transition"
            aria-label="Yeni randevu ekle"
            title="Yeni randevu ekle"
          >
            +
          </a>  <div className="mt-4 space-y-3 md:hidden">
    {loading && (
      <div className="rounded-2xl border border-white/10 bg-neutral-900 p-4 text-sm text-neutral-400">
        Yükleniyor…
      </div>
    )}

    {!loading && viewRows.length === 0 && (
      <div className="rounded-2xl border border-white/10 bg-neutral-900 p-4 text-center">
        <div className="text-sm font-semibold text-neutral-100">Kayıt bulunamadı</div>
        <div className="mt-1 text-xs text-white/50">Filtreleri değiştir veya yeni randevu ekle.</div>
      </div>
    )}

    {!loading && viewRows.map((r) => {
      const reason = cancelReasonLabel(r.cancel_reason ?? null);
      const totalMin = minutesBetween(r.start_at, r.end_at);

        const startMs = Date.parse(r.start_at);
        const minsTo = Number.isFinite(startMs)
          ? Math.floor((startMs - Date.now()) / 60000)
          : 999999;

        const isUpcoming = minsTo >= 0 && minsTo <= 90;


      return (
        <div
          key={r.id}
          className={`relative overflow-hidden rounded-2xl border border-white/10 bg-neutral-900 p-4 text-neutral-100 ${
            String(r.status || "").toLowerCase() === "cancelled" || String(r.status || "").toLowerCase() === "no_show"
              ? "before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-rose-400/80"
              : String(r.deposit_status || "").toLowerCase().trim() === "paid"
                ? "before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-emerald-400/80"
                : (String(r.deposit_status || "").toLowerCase().trim() === "pending" ||
                   String(r.deposit_status || "").toLowerCase().trim() === "required")
                  ? "before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-amber-400/80"
                  : "before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-white/10"
          }`}
        >
          <div className="relative flex items-start justify-between gap-3">
            {isUpcoming && (
              <div className="absolute right-3 top-3 text-[10px] px-2 py-0.5 rounded-full border border-mc-bronze/40 text-mc-bronze bg-mc-black">
                Sıradaki
              </div>
            )}

            <div>
              <div className="text-xl md:text-2xl font-semibold leading-none">{fmtT(r.start_at)}</div>
              <div className="mt-2 text-xs text-white/50">{(r.start_at || "").slice(0, 10)} • {totalMin} dk</div>
            </div>

              <div
                className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${
                  r.status === "cancelled"
                    ? "border-rose-400/30 bg-rose-500/10 text-rose-300"
                    : r.status === "no_show"
                      ? "border-rose-400/30 bg-rose-500/10 text-rose-300"
                      : depBadgeClass(r.deposit_status ?? null)
                }`}
              >
                {r.status === "cancelled"
                  ? "İptal"
                  : r.status === "no_show"
                    ? "Gelmedi"
                    : depLabel(r.deposit_status ?? null)}
              </div>
          </div>

          <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-2.5">
            <div className="font-semibold text-neutral-100">{r.customer_name}</div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <div className="min-w-0 truncate text-sm text-white/60">{r.customer_phone_e164 || r.customer_phone}</div>
              <button
                type="button"
                className="shrink-0 rounded-full border border-white/10 bg-neutral-900 px-2.5 py-1 text-[11px] text-white/70 hover:border-mc-bronze hover:text-neutral-100 transition"
                onClick={() => {
                  const phone = r.customer_phone_e164 || r.customer_phone || "";
                  const msg = buildReminderMessage({
                    customerName: r.customer_name,
                    date: (r.start_at || "").slice(0, 10),
                    time: fmtT(r.start_at),
                    serviceSummary: r.service_summary ?? "—",
                  });
                  window.open(buildWhatsAppWebUrl(phone, msg), "_blank");
                }}
              >
                Mesaj
              </button>
            </div>
            <div className="mt-3 text-sm font-medium text-neutral-100">{r.service_summary ?? "—"}</div>

            {typeof r.total_price === "number" && (
              <div className="mt-2 text-sm text-white/60">{r.total_price} TL</div>
            )}

            {typeof r.deposit_amount === "number" && (
              <div className="mt-1 text-sm text-white/60">Depozito {r.deposit_amount} TL</div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-white/10 bg-neutral-900 px-2 py-0.5 text-[11px] text-white/70">
                {r.status === "no_show" ? "Gelmedi" : r.status === "cancelled" ? "İptal" : r.status === "booked" ? "Onaylandı" : r.status}
              </span>

              {r.status === "cancelled" && reason && (
                <span className="rounded-full border border-white/10 bg-neutral-900 px-2 py-0.5 text-[11px] text-white/70">
                  {reason}
                </span>
              )}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="wa-dropdown">
            <button
              className="w-full rounded-xl border border-white/10 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 hover:bg-neutral-700 hover:border-mc-bronze transition"
              onClick={() => {
                setActionMenuId(null);
                setWaMenuId(waMenuId === r.id ? null : r.id);
              }}
            >
              WhatsApp
            </button>

              </div>
              <div className="action-dropdown">
            <button
              className="w-full rounded-xl border border-white/10 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 hover:bg-neutral-700 hover:border-mc-bronze transition"
              onClick={() => {
                setWaMenuId(null);
                setActionMenuId(actionMenuId === r.id ? null : r.id);
              }}
            >
              İşlemler
            </button>
          </div>
              </div>

          {waMenuId === r.id && (
            <div className="wa-dropdown mt-3 overflow-hidden rounded-2xl border border-white/10 bg-neutral-950">
              <button
                className="w-full px-4 py-3 text-left text-sm hover:bg-white/5 transition-colors"
                onClick={async () => {
                  setWaMenuId(null);
                  const pmt = await fetchPayment();
                  if (!pmt) return alert("Ödeme bilgileri alınamadı");
                  const msg = buildDepositPaymentMessage(
                    {
                      customerName: r.customer_name,
                      dateISO: r.start_at,
                      serviceSummary: r.service_summary ?? "—",
                      totalPrice: r.total_price ?? 0,
                      depositAmount: r.deposit_amount ?? 0,
                    },
                    pmt
                  );
                  const phone = r.customer_phone_e164 || r.customer_phone || "";
                  window.open(buildWhatsAppWebUrl(phone, msg), "_blank");
                }}
              >
                Ödeme Mesajı Aç
              </button>

              <button
                className="w-full px-4 py-3 text-left text-sm hover:bg-white/5 transition-colors"
                onClick={() => {
                  setWaMenuId(null);
                  const phone = r.customer_phone_e164 || r.customer_phone || "";
                  const msg = buildApprovalMessage({
                    customerName: r.customer_name,
                    date: (r.start_at || "").slice(0, 10),
                    time: fmtT(r.start_at),
                    serviceSummary: r.service_summary ?? "—",
                  });
                  window.open(buildWhatsAppWebUrl(phone, msg), "_blank");
                }}
              >
                Onay Mesajı
              </button>

              <button
                className="w-full px-4 py-3 text-left text-sm hover:bg-white/5 transition-colors"
                onClick={() => {
                  setWaMenuId(null);
                  const phone = r.customer_phone_e164 || r.customer_phone || "";
                  const msg = buildReminderMessage({
                    customerName: r.customer_name,
                    date: (r.start_at || "").slice(0, 10),
                    time: fmtT(r.start_at),
                    serviceSummary: r.service_summary ?? "—",
                  });
                  window.open(buildWhatsAppWebUrl(phone, msg), "_blank");
                }}
              >
                Hatırlatma
              </button>
            </div>
          )}

          {actionMenuId === r.id && (
            <div className="action-dropdown mt-3 overflow-hidden rounded-2xl border border-white/10 bg-neutral-950">
              <button
                className="w-full px-4 py-3 text-left text-sm hover:bg-white/5 transition-colors"
                onClick={() => {
                  setActionMenuId(null);
                  setExpandedId(expandedId === r.id ? null : r.id);
                }}
              >
                {expandedId === r.id ? "Detayı Kapat" : "Detayı Aç"}
              </button>

              {r.status !== "cancelled" &&
                !["paid", "odendi", "ödendi", "completed", "confirmed"].includes(
                  String(r.deposit_status || "").toLowerCase().trim()
                ) && (
                  <button
                    className="w-full px-4 py-3 text-left text-sm hover:bg-white/5 transition-colors"
                    onClick={() => {
                      setActionMenuId(null);
                      markÖdendi(r.id);
                    }}
                  >
                    Ödeme Geldi
                  </button>
                )}

              {r.status !== "cancelled" && r.status !== "no_show" && (
                <button
                  className="w-full px-4 py-3 text-left text-sm hover:bg-white/5 transition-colors"
                  onClick={() => {
                    setActionMenuId(null);
                    markNoShow(r.id);
                  }}
                >
                  No-show
                </button>
              )}

              {r.status !== "cancelled" && (
                <>
                  <div className="h-px bg-white/10" />
                  <button
                    className="w-full px-4 py-3 text-left text-sm text-rose-400 hover:bg-white/5 transition-colors"
                    onClick={() => {
                      setActionMenuId(null);
                      cancel(r.id);
                    }}
                  >
                    İptal
                  </button>
                </>
              )}
            </div>
          )}

          {expandedId === r.id && (
            <div className="mt-3 rounded-2xl border border-white/10 bg-neutral-950/80 p-3 shadow-inner">
              <div className="text-sm font-semibold text-neutral-100">Bloklar</div>
              {(r.blocks ?? []).length === 0 ? (
                <div className="mt-2 text-sm text-white/50">Blok bulunamadı.</div>
              ) : (
                <div className="mt-3 space-y-2">
                  {(r.blocks ?? []).map((b, idx) => (
                    <div key={`${b.resource}-${b.start_at}-${idx}`} className="rounded-xl border border-white/10 bg-neutral-900/90 p-3 text-sm shadow-sm">
                      <div className="font-medium text-neutral-100">{b.service_name ?? "—"}</div>
                      <div className="mt-1 text-white/70">{fmtT(b.start_at)} – {fmtT(b.end_at)}</div>
                      <div className="mt-1 text-xs text-white/60">
                        {b.resource === "hair" ? `Berber: ${b.barber_name ?? "—"}` : (b.resource === "external" ? "Harici" : "Niyazi")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      );
    })}
  </div>



<div className="mt-6 hidden md:block overflow-x-auto rounded-2xl border border-white/10 bg-neutral-900 text-neutral-100 [-webkit-overflow-scrolling:touch]">
        <div className="max-h-[65vh] overflow-y-auto">

          <table className="w-full text-[13px]">
          <thead className="sticky top-0 z-10 bg-neutral-900/95 backdrop-blur border-b border-white/10 text-left text-white/70">
            <tr>
              <th className="p-2 md:p-3">Zaman</th>
              <th className="p-2 md:p-3">Müşteri</th>
              <th className="hidden md:table-cell p-2 md:p-3">Hizmet</th>
              <th className="hidden md:table-cell p-2 md:p-3">Depozito</th>
              <th className="p-2 md:p-3">İşlem</th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr><td className="p-2.5 text-neutral-400" colSpan={5}>Yükleniyor…</td></tr>
            )}

            {!loading && viewRows.length === 0 && (
              <tr>
  <td className="p-6 md:p-10" colSpan={5}>
    <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-neutral-900">📅</div>
      <div className="text-sm font-semibold text-neutral-100">Kayıt bulunamadı</div>
      <div className="mt-1 text-xs text-white/50">Filtreleri değiştir veya yeni randevu ekle.</div>
      <a href="/admin/manual-appointment" className="mt-4 inline-flex items-center justify-center rounded-xl border border-mc-bronze bg-mc-black px-4 py-2 text-sm text-mc-bronze hover:bg-mc-bronze hover:text-neutral-100 transition">Yeni Randevu Ekle</a>
    </div>
  </td>
</tr>
            )}

            {viewRows.map((r) => {
              const reason = cancelReasonLabel(r.cancel_reason ?? null);
              const totalMin = minutesBetween(r.start_at, r.end_at);

              
                const dep = String(r.deposit_status || "").toLowerCase().trim();
                const startMs = Date.parse(r.start_at);
                const minsTo = Number.isFinite(startMs) ? Math.floor((startMs - Date.now()) / 60_000) : 999999;
                const needsDeposit = dep === "pending" || dep === "required";
                const waDot = dep === "paid"
                  ? "green"
                  : needsDeposit && minsTo <= 120
                    ? "red"
                    : needsDeposit && minsTo <= 360
                      ? "amber"
                      : null;
                const waBtnTone =
                  waDot === "green"
                    ? "border-emerald-400/40 shadow-[0_0_0_1px_rgba(52,211,153,0.25),0_0_18px_rgba(52,211,153,0.18)]"
                    : waDot === "red"
                      ? "border-rose-400/40 shadow-[0_0_0_1px_rgba(251,113,133,0.25),0_0_18px_rgba(251,113,133,0.18)]"
                      : waDot === "amber"
                        ? "border-amber-400/40 shadow-[0_0_0_1px_rgba(251,191,36,0.22),0_0_18px_rgba(251,191,36,0.16)]"
                        : "";
                  (r.status === "cancelled" || r.status === "no_show")
return (
                <React.Fragment key={r.id}>
                  <tr className={rowClass(r)}>
                    <td className="relative p-2 pl-3 md:p-2.5 md:pl-4">
                      <span
                        className={`absolute left-0 top-0 h-full w-[3px] rounded-r ${
                          (r.status === "cancelled" || r.status === "no_show")
                            ? "bg-rose-400/70"
                            : String(r.deposit_status || "").toLowerCase().trim() === "paid"
                              ? "bg-emerald-400/70"
                              : (String(r.deposit_status || "").toLowerCase().trim() === "pending" ||
                                 String(r.deposit_status || "").toLowerCase().trim() === "required")
                                ? "bg-amber-400/70"
                                : "bg-white/10"
                        }`}
                      />
                      <div className="text-base font-semibold text-neutral-100 leading-5">{fmtT(r.start_at)}</div>
                      <div className="text-xs text-white/50">{(r.start_at || "").slice(0, 10)} • {totalMin} dk</div>
                    </td>

                    <td className="p-2 md:p-2.5">
                      <div className="font-semibold text-neutral-100 leading-5">{r.customer_name}</div>
                      <div className="text-xs text-white/50">{r.customer_phone_e164 || r.customer_phone}</div>

                        <div className="mt-2">
                          <span className="inline-flex items-center rounded-full border border-white/10 px-2 py-0.5 text-[11px] bg-neutral-900 text-white/70">
                            {r.status === "no_show" ? "Gelmedi" : r.status === "cancelled" ? "İptal" : r.status === "booked" ? "Onaylandı" : r.status}
                          </span>
                        </div>
{r.status === "cancelled" && reason && (
                        <div className="mt-1 text-xs">
                          <span className="rounded-full border border-white/10 px-2 py-0.5 bg-neutral-900 text-white/70">{reason}</span>
                        </div>
                      )}
                    </td>

                    <td className="p-2.5">
                      <div className="font-medium">{r.service_summary ?? "—"}</div>
                      {typeof r.total_price === "number" && (
                        <div className="mt-0.5 text-[11px] text-white/50">Toplam • {r.total_price} TL</div>
                      )}
                    </td>

                    <td className="p-2.5">
                        <div
                          className={`inline-flex items-center rounded-full border px-2 py-1 text-xs ${
                            r.status === "cancelled"
                              ? "border-rose-400/30 bg-rose-500/10 text-rose-300"
                              : r.status === "no_show"
                                ? "border-rose-400/30 bg-rose-500/10 text-rose-300"
                                : depBadgeClass(r.deposit_status ?? null)
                          }`}
                        >
                          {r.status === "cancelled"
                            ? "İptal"
                            : r.status === "no_show"
                              ? "Gelmedi"
                              : depLabel(r.deposit_status ?? null)}
                        </div>
                      {typeof r.deposit_amount === "number" && (
                        <div className="mt-0.5 text-[11px] text-white/50">Tutar • {r.deposit_amount} TL</div>
                      )}
                    </td>

                    <td className="p-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="wa-dropdown relative">
                            <button
                              className={`w-full md:w-auto rounded-xl border border-white/10 bg-neutral-900 px-3 md:px-4 py-2 text-sm text-neutral-100 hover:border-mc-bronze transition `}
                              onClick={() => {
                                  setActionMenuId(null);
                                  setWaMenuId(waMenuId === r.id ? null : r.id);
                                }}
                            >                                WhatsApp ▾
                                {waDot && (
  <span className="absolute right-3 top-1/2 -translate-y-1/2">
    <span className={
      "absolute inline-flex h-2.5 w-2.5 animate-ping rounded-full " +
      (waDot === "green"
        ? "bg-emerald-400/35"
        : waDot === "red"
          ? "bg-rose-400/35"
          : "bg-amber-400/35")
    } />
    <span className={
      "relative inline-flex h-2.5 w-2.5 rounded-full " +
      (waDot === "green"
        ? "bg-emerald-400"
        : waDot === "red"
          ? "bg-rose-400"
          : "bg-amber-400")
    } />
  </span>
)}
</button>

                            {waMenuId === r.id && (
                              <div className="absolute right-0 z-30 mt-2 w-60 overflow-hidden rounded-2xl border border-white/10 bg-neutral-900 shadow-xl ring-1 ring-black/5 text-neutral-100">
                                <button
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-white/5 transition-colors"
                                  onClick={async () => {
                                    setWaMenuId(null);
                                    const pmt = await fetchPayment();
                                    if (!pmt) return alert("Ödeme bilgileri alınamadı");
                                    const msg = buildDepositPaymentMessage(
                                      {
                                        customerName: r.customer_name,
                                        dateISO: r.start_at,
                                        serviceSummary: r.service_summary ?? "—",
                                        totalPrice: r.total_price ?? 0,
                                        depositAmount: r.deposit_amount ?? 0,
                                      },
                                      pmt
                                    );
                                    const phone = (r.customer_phone_e164 || r.customer_phone || "");
                                    window.location.href = buildWhatsAppWebUrl(phone, msg);
                                  }}
                                >
                                  Ödeme Mesajı Aç
                                </button>

                                <button
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-white/5 transition-colors"
                                  onClick={async () => {
                                    setWaMenuId(null);
                                    const pmt = await fetchPayment();
                                    if (!pmt) return alert("Ödeme bilgileri alınamadı");
                                    const msg = buildDepositPaymentMessage(
                                      {
                                        customerName: r.customer_name,
                                        dateISO: r.start_at,
                                        serviceSummary: r.service_summary ?? "—",
                                        totalPrice: r.total_price ?? 0,
                                        depositAmount: r.deposit_amount ?? 0,
                                      },
                                      pmt
                                    );
                                    try {
                                      await navigator.clipboard.writeText(msg);
                                      alert("Mesaj kopyalandı ✅");
                                    } catch {
                                      alert("Kopyalanamadı");
                                    }
                                  }}
                                >
                                  Ödeme Mesajı Kopyala
                                </button>

                                <div className="h-px bg-white/10" />

                                <button
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-white/5 transition-colors"
                                  onClick={() => {
                                    setWaMenuId(null);
                                    const phone = (r.customer_phone_e164 || r.customer_phone || "");
                                    const msg = buildApprovalMessage({
                                      customerName: r.customer_name,
                                      date: (r.start_at || "").slice(0, 10),
                                      time: fmtT(r.start_at),
                                      serviceSummary: r.service_summary ?? "—",
                                    });
                                    window.open(buildWhatsAppWebUrl(phone, msg), "_blank");
                                  }}
                                >
                                  Onay Mesajı
                                </button>

                                <button
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-white/5 transition-colors"
                                  onClick={() => {
                                    setWaMenuId(null);
                                    const phone = (r.customer_phone_e164 || r.customer_phone || "");
                                    const msg = buildReminderMessage({
                                      customerName: r.customer_name,
                                      date: (r.start_at || "").slice(0, 10),
                                      time: fmtT(r.start_at),
                                      serviceSummary: r.service_summary ?? "—",
                                    });
                                    window.open(buildWhatsAppWebUrl(phone, msg), "_blank");
                                  }}
                                >
                                  Hatırlatma
                                </button>
                              </div>

                              )}
                            </div>

                          <div className="action-dropdown relative">
                            <button
                              className={`rounded-xl border border-white/10 bg-neutral-900 px-4 py-2 text-sm text-neutral-100 hover:border-mc-bronze transition `}
                              onClick={() => {
                                  setWaMenuId(null);
                                  setActionMenuId(actionMenuId === r.id ? null : r.id);
                                }}
                            >
                              İşlemler ▾
                            </button>

                            {actionMenuId === r.id && (
                              <div className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-2xl border border-white/10 bg-neutral-900 shadow-xl ring-1 ring-black/5 text-neutral-100">
                                <button
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-white/5 transition-colors"
                                  onClick={() => {
                                    setActionMenuId(null);
                                    setExpandedId(expandedId === r.id ? null : r.id);
                                  }}
                                >
                                  {expandedId === r.id ? "Detayı Kapat" : "Detayı Aç"}
                                </button>

                                {r.status !== "cancelled" &&
                                  !["paid", "odendi", "ödendi", "completed", "confirmed"].includes(
                                    String(r.deposit_status || "").toLowerCase().trim()
                                  ) && (
                                    <button
                                      className="w-full px-4 py-2 text-left text-sm hover:bg-white/5 transition-colors"
                                      onClick={() => {
                                        setActionMenuId(null);
                                        markÖdendi(r.id);
                                      }}
                                    >
                                      Ödeme Geldi
                                    </button>
                                  )}

                                {r.status !== "cancelled" && r.status !== "no_show" && (
                                  <button
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-white/5 transition-colors"
                                    onClick={() => {
                                      setActionMenuId(null);
                                      markNoShow(r.id);
                                    }}
                                  >
                                    No-show
                                  </button>
                                )}

                                <div className="h-px bg-white/10" />

                                {r.status !== "cancelled" && (
                                  <button
                                    className="w-full px-4 py-2 text-left text-sm text-rose-700 hover:bg-white/5 transition-colors"
                                    onClick={() => {
                                      setActionMenuId(null);
                                      cancel(r.id);
                                    }}
                                  >
                                    İptal
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                  </tr>

                  {expandedId === r.id && (
                    <tr className="border-t bg-white/5">
                      <td className="p-2.5" colSpan={5}>
                        <div className="text-sm font-semibold text-neutral-100">Bloklar</div>
                        {(r.blocks ?? []).length === 0 ? (
                          <div className="mt-2 text-sm text-white/50">Blok bulunamadı.</div>
                        ) : (
                          <div className="mt-3 space-y-2">
                            {(r.blocks ?? []).map((b, idx) => (
                              <div key={`${b.resource}-${b.start_at}-${idx}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-neutral-900 p-2 text-sm text-neutral-100">
                                <div className="font-medium">{b.service_name ?? "—"}</div>
                                <div className="text-white/70">{fmtT(b.start_at)} – {fmtT(b.end_at)}</div>
                                <div className="text-xs text-white/60">
                                  {b.resource === "hair" ? `Berber: ${b.barber_name ?? "—"}` : (b.resource === "external" ? "Harici" : "Niyazi")}
                                </div>
                                <div className="text-xs text-white/50">{b.status}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  );
}
