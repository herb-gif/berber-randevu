"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { buildDepositPaymentMessage, buildApprovalMessage, buildReminderMessage, buildWhatsAppWebUrl } from "@/lib/whatsapp";
import { useRouter, useSearchParams } from "next/navigation";

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

const TZ = "Europe/Istanbul";
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
  if (v === "paid") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (v === "forfeited") return "bg-rose-50 text-rose-700 border-rose-200";
    if (v === "refunded") return "bg-blue-50 text-blue-700 border-blue-200";
  if (v === "required") return "bg-amber-50 text-amber-800 border-amber-200";
  if (v === "pending") return "bg-neutral-50 text-neutral-700 border-neutral-200";
  if (v === "cancelled") return "bg-neutral-100 text-neutral-600 border-neutral-200";
  return "bg-neutral-50 text-neutral-700 border-neutral-200";
}
function cancelReasonLabel(r?: string | null) {
  if (!r) return null;
  if (r === "admin") return "🔴 Admin iptal";
  if (r === "auto_no_deposit") return "🟠 Otomatik iptal (depozito yok)";
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

  if (status === "no_show") return "border-t align-top bg-rose-50/70";
  if (status === "cancelled") return "border-t align-top bg-neutral-50 text-neutral-500";

  if (dep === "refunded") return "border-t align-top bg-blue-50/60";
  if (dep === "forfeited") return "border-t align-top bg-rose-50/50";
  if (dep === "paid") return "border-t align-top bg-emerald-50/40";

  return "border-t align-top";
}
function minutesBetween(a: string, b: string) {
  const x = Date.parse(a);
  const y = Date.parse(b);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return 0;
  return Math.max(0, Math.round((y - x) / 60000));
}

export default function AdminDashboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
    const [filterQ, setFilterQ] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");
    const [filterDep, setFilterDep] = useState("all");

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

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [days]);


    useEffect(() => {
      if (didInitFiltersRef.current) return;
      didInitFiltersRef.current = true;

      const q = searchParams.get("q") || "";
      const st = searchParams.get("status") || "all";
      const dep = searchParams.get("dep") || "all";

      setFilterQ(q);
      setFilterStatus(st);
      setFilterDep(dep);
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

      const qs = params.toString();
      router.replace(qs ? `/admin?${qs}` : "/admin");
      // eslint-disable-next-line react-hooks/exhaustive-deps

}, [filterQ, filterStatus, filterDep]);

    useEffect(() => {
      // Filtre değişince tabloya kaydır
      tableTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterQ, filterStatus, filterDep]);






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
    copy.sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

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
    }, [sortedRows, filterQ, filterStatus, filterDep]);

  async function cancel(id: string) {
      if (!confirm("Randevu iptal edilsin mi?")) return;

      const res = await fetch("/api/admin/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "cancel" }),
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
    }


  async function markPaid(id: string) {
      const res = await fetch("/api/admin/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "mark_paid" }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) return alert(data.error || "Depozito güncellenemedi");

      setRows((prev) => (prev || []).map((r) => (r.id === id ? { ...r, deposit_status: "paid" } : r)));
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
    }



  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    location.reload();
  }

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Admin Panel</h1>
          <div className="text-sm text-neutral-600">Randevular + depozito + WhatsApp mesaj</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select className="rounded-xl border border-mc-border bg-white px-4 py-2 text-sm text-mc-dark hover:border-mc-bronze transition" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={1}>1 gün</option>
            <option value={7}>7 gün</option>
            <option value={14}>14 gün</option>
            <option value={30}>30 gün</option>
            <option value={60}>60 gün</option>
          </select>

          <button onClick={load} className="rounded-xl border border-mc-border bg-white px-4 py-2 text-sm text-mc-dark hover:border-mc-bronze transition">Yenile</button>
          <button onClick={logout} className="rounded-lg bg-black px-3 py-2 text-white">Çıkış</button>
        </div>
      </div>

      
        {/* Summary Cards */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-mc-border bg-white p-4 shadow-sm">
            <div className="text-xs text-neutral-500">Bugünkü Randevu</div>
            <div className="mt-1 text-2xl font-semibold">{todaySummary.todayCount}</div>
          </div>

          <div className="rounded-2xl border border-mc-border bg-white p-4 shadow-sm">
            <div className="text-xs text-neutral-500">Bugünkü Ciro</div>
            <div className="mt-1 text-2xl font-semibold">
              {todaySummary.todayRevenue.toLocaleString("tr-TR")} TL
            </div>
          </div>

          <div className="rounded-2xl border border-mc-border bg-white p-4 shadow-sm">
            <div className="text-xs text-neutral-500">Bekleyen Depozito</div>
            <div className="mt-1 text-2xl font-semibold">{todaySummary.pendingDepositCount}</div>
          </div>

          <div className="rounded-2xl border border-mc-border bg-white p-4 shadow-sm">
            <div className="text-xs text-neutral-500">Bugünkü No-show</div>
            <div className="mt-1 text-2xl font-semibold">{todaySummary.noShowCount}</div>
          </div>
        </div>

        {/* Filtreler */}
        <div className="mt-6 rounded-2xl border border-mc-border bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex-1">
              <div className="text-xs text-neutral-500">Arama</div>
              <input
                value={filterQ}
                onChange={(e) => setFilterQ(e.target.value)}
                placeholder="İsim / telefon / hizmet…"
                className="mt-1 w-full rounded-xl border border-mc-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mc-bronze/30 focus:border-mc-bronze"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <div>
                <div className="text-xs text-neutral-500">Durum</div>
                <select
                  className="mt-1 rounded-xl border border-mc-border bg-white px-3 py-2 text-sm"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="all">Hepsi</option>
                  <option value="booked">Booked</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="no_show">No-show</option>
                </select>
              </div>

              <div>
                <div className="text-xs text-neutral-500">Depozito</div>
                <select
                  className="mt-1 rounded-xl border border-mc-border bg-white px-3 py-2 text-sm"
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
                  className="mt-1 rounded-xl border border-mc-border bg-white px-3 py-2 text-sm text-mc-dark hover:border-mc-bronze transition"
                  onClick={() => {
                    setFilterQ("");
                    setFilterStatus("all");
                    setFilterDep("all");
                  }}
                >
                  Temizle
                </button>
              </div>

            </div>
          </div>

          <div className="mt-2 text-xs text-neutral-500">
            Gösterilen: <span className="font-medium text-neutral-900">{viewRows.length}</span>
          </div>
        </div>

        <div ref={tableTopRef} />

<div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-neutral-600">
            <tr>
              <th className="p-3">Zaman</th>
              <th className="p-3">Müşteri</th>
              <th className="p-3">Hizmet</th>
              <th className="p-3">Depozito</th>
              <th className="p-3">İşlem</th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr><td className="p-3 text-neutral-500" colSpan={5}>Yükleniyor…</td></tr>
            )}

            {!loading && viewRows.length === 0 && (
              <tr><td className="p-3 text-neutral-500" colSpan={5}>Kayıt yok.</td></tr>
            )}

            {viewRows.map((r) => {
              const reason = cancelReasonLabel(r.cancel_reason ?? null);
              const totalMin = minutesBetween(r.start_at, r.end_at);

              return (
                <React.Fragment key={r.id}>
                  <tr className={rowClass(r)}>
                    <td className="p-3">
                      <div className="font-medium">{fmtDT(r.start_at)}</div>
                      <div className="text-xs text-neutral-500">{fmtDT(r.end_at)} • {totalMin} dk</div>
                    </td>

                    <td className="p-3">
                      <div className="font-medium">{r.customer_name}</div>
                      <div className="text-xs text-neutral-500">
                        {r.customer_phone_e164 || r.customer_phone}
                      </div>
                      <div className="mt-1 text-xs text-neutral-500">
                        Durum: <span className="font-medium">{r.status === "no_show" ? "No-show" : r.status}</span>
                      </div>
                      {r.status === "cancelled" && reason && (
                        <div className="mt-1 text-xs">
                          <span className="rounded-full border px-2 py-0.5 bg-neutral-50">{reason}</span>
                        </div>
                      )}
                    </td>

                    <td className="p-3">
                      <div className="font-medium">{r.service_summary ?? "—"}</div>
                      {typeof r.total_price === "number" && (
                        <div className="mt-1 text-xs text-neutral-500">Toplam: {r.total_price} TL</div>
                      )}
                    </td>

                    <td className="p-3">
                      <div className={`inline-flex items-center rounded-full border px-2 py-1 text-xs ${depBadgeClass(r.deposit_status ?? null)}`}>
                        {depLabel(r.deposit_status ?? null)}
                      </div>
                      {typeof r.deposit_amount === "number" && (
                        <div className="mt-1 text-xs text-neutral-500">Tutar: {r.deposit_amount} TL</div>
                      )}
                    </td>

                    <td className="p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="wa-dropdown relative">
                            <button
                              className="rounded-xl border border-mc-border bg-white px-4 py-2 text-sm text-mc-dark hover:border-mc-bronze transition"
                              onClick={() => {
                                  setActionMenuId(null);
                                  setWaMenuId(waMenuId === r.id ? null : r.id);
                                }}
                            >
                              WhatsApp ▾
                            </button>

                            {waMenuId === r.id && (
                              <div className="absolute right-0 z-30 mt-2 w-60 overflow-hidden rounded-2xl border border-mc-border bg-white shadow-xl ring-1 ring-black/5">
                                <button
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-neutral-100 transition"
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
                                    window.open(buildWhatsAppWebUrl(phone, msg), "_blank");
                                  }}
                                >
                                  Ödeme Mesajı Aç
                                </button>

                                <button
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-neutral-100 transition"
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

                                <div className="h-px bg-neutral-100" />

                                <button
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-neutral-100 transition"
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
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-neutral-100 transition"
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
                              className="rounded-xl border border-mc-border bg-white px-4 py-2 text-sm text-mc-dark hover:border-mc-bronze transition"
                              onClick={() => {
                                  setWaMenuId(null);
                                  setActionMenuId(actionMenuId === r.id ? null : r.id);
                                }}
                            >
                              İşlemler ▾
                            </button>

                            {actionMenuId === r.id && (
                              <div className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-2xl border border-mc-border bg-white shadow-xl ring-1 ring-black/5">
                                <button
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-neutral-100 transition"
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
                                      className="w-full px-4 py-2 text-left text-sm hover:bg-neutral-100 transition"
                                      onClick={() => {
                                        setActionMenuId(null);
                                        markPaid(r.id);
                                      }}
                                    >
                                      Ödeme Geldi
                                    </button>
                                  )}

                                {r.status !== "cancelled" && r.status !== "no_show" && (
                                  <button
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-neutral-100 transition"
                                    onClick={() => {
                                      setActionMenuId(null);
                                      markNoShow(r.id);
                                    }}
                                  >
                                    No-show
                                  </button>
                                )}

                                <div className="h-px bg-neutral-100" />

                                {r.status !== "cancelled" && (
                                  <button
                                    className="w-full px-4 py-2 text-left text-sm text-rose-700 hover:bg-neutral-100 transition"
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
                    <tr className="border-t bg-neutral-50">
                      <td className="p-3" colSpan={5}>
                        <div className="text-sm font-semibold">Bloklar</div>
                        {(r.blocks ?? []).length === 0 ? (
                          <div className="mt-2 text-sm text-neutral-600">Blok bulunamadı.</div>
                        ) : (
                          <div className="mt-3 space-y-2">
                            {(r.blocks ?? []).map((b, idx) => (
                              <div key={`${b.resource}-${b.start_at}-${idx}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-white p-2 text-sm">
                                <div className="font-medium">{b.service_name ?? "—"}</div>
                                <div className="text-neutral-700">{fmtT(b.start_at)} – {fmtT(b.end_at)}</div>
                                <div className="text-xs text-neutral-600">
                                  {b.resource === "hair" ? `Berber: ${b.barber_name ?? "—"}` : (b.resource === "external" ? "Harici" : "Niyazi")}
                                </div>
                                <div className="text-xs text-neutral-500">{b.status}</div>
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
  );
}
