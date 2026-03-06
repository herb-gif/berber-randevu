"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type Appointment = {
  id: string;
  customer_name: string;
  start_at: string;
  end_at: string;
  created_at?: string | null;
  deposit_status?: string | null;
  status?: string | null;
  barber_name: string | null;
  service_summary: string | null;
  total_price: number | null;
  deposit_amount: number | null;
};

type Payment =
  | {
      bank_name: string;
      iban: string;
      account_name?: string | null;
      note?: string | null;
      whatsapp_phone_e164?: string | null;
    }
  | null;

const TZ = "Europe/Istanbul";
const dtf = new Intl.DateTimeFormat("tr-TR", { timeZone: TZ, dateStyle: "short", timeStyle: "short" });
const tf = new Intl.DateTimeFormat("tr-TR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

function fmtDT(iso: string) {
  try {
    return dtf.format(new Date(iso));
  } catch {
    return iso;
  }
}
function fmtT(iso: string) {
  try {
    return tf.format(new Date(iso));
  } catch {
    return iso;
  }
}


function formatSec(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export default function ConfirmationPage() {
  const params = useParams();
  const id =
    typeof (params as any)?.id === "string"
      ? String((params as any).id)
      : Array.isArray((params as any)?.id)
        ? String((params as any).id[0])
        : "";

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [appt, setAppt] = useState<Appointment | null>(null);
  const [payment, setPayment] = useState<Payment>(null);

  const [showConfetti, setShowConfetti] = useState(true);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const DEPOSIT_TOTAL_SEC = 20 * 60;


  async function refetchAppointment() {
    if (!id) return;
    try {
      // NOTE: If your endpoint differs, change only this URL:
      const res = await fetch(`/api/confirmation?id=${encodeURIComponent(id)}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      // Accept both shapes: { appointment: {...} } OR direct {...}
      // In TS runtime, just handle common JS shapes:
      const apptObj = (data && (data.appointment || data.appt || data)) || null;
      if (apptObj && typeof apptObj === "object") {
        // setAppt exists in this file already
        // @ts-ignore
        setAppt(apptObj);
      }
    } catch {
      // ignore
    }
  }

  // Auto-refresh: focus + short polling while unpaid
  useEffect(() => {
    if (!id) return;

    // 1) Refetch when user focuses the tab/window
    const onFocus = () => { refetchAppointment(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    // 2) Poll while not paid (stops when paid)
    let it: any = null;
    const paidLike = ["paid","odendi","ödendi","completed","confirmed"].includes(String(appt?.deposit_status || "").toLowerCase().trim());

    if (!paidLike) {
      it = setInterval(() => {
        refetchAppointment();
      }, 4000);
    }

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      if (it) clearInterval(it);
    };
  }, [id, appt?.deposit_status]);

const isPaid = useMemo(() => {
    const v = String(appt?.deposit_status || "").toLowerCase().trim();
    return v === "paid" || v === "odendi" || v === "ödendi" || v === "completed" || v === "confirmed";
  }, [appt?.deposit_status]);
  // Confetti auto-hide
  useEffect(() => {
    const t = setTimeout(() => setShowConfetti(false), 1200);
    return () => clearTimeout(t);
  }, []);

  // Fetch (never stuck) + abort timeouts
  useEffect(() => {
    let cancelled = false;

    // hard timeout: 8s
    const hard = setTimeout(() => {
      if (cancelled) return;
      setToast((t) => t || "Bağlantı yavaş. Lütfen sayfayı yenileyin.");
      setLoading(false);
    }, 8000);

    const ctrl1 = new AbortController();
    const ctrl2 = new AbortController();
    const t1 = setTimeout(() => ctrl1.abort(), 6000);
    const t2 = setTimeout(() => ctrl2.abort(), 6000);

    (async () => {
      try {
        if (!id) {
          setToast("Geçersiz randevu ID");
          return;
        }

        const a = await fetch(`/api/confirmation?id=${encodeURIComponent(id)}`, {
          cache: "no-store",
          signal: ctrl1.signal,
        });
        const aj = await a.json().catch(() => ({}));
        if (!a.ok) {
          setToast(aj.error || "Randevu bulunamadı");
          return;
        }
        if (!cancelled) setAppt(aj.appointment);

        const pr = await fetch(`/api/payment`, { cache: "no-store", signal: ctrl2.signal });
        const pj = await pr.json().catch(() => ({}));
        if (!cancelled) setPayment(pj.payment ?? null);
      } catch (e: any) {
        // AbortError dev modda normal; loglamayalım
        if (e?.name !== "AbortError") console.error("confirmation load failed", e);
        if (!cancelled) {
          setToast(
            e?.name === "AbortError"
              ? "Bağlantı zaman aşımına uğradı. Lütfen tekrar deneyin."
              : "Bir hata oluştu. Lütfen tekrar deneyin."
          );
        }
      } finally {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(hard);
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(hard);
      ctrl1.abort();
      ctrl2.abort();
    };
  }, [id]);

  // Deposit countdown: starts when appointment is loaded (stops when paid)
  useEffect(() => {

    // If already paid, stop countdown
    if (isPaid) {
      try {
        if (id) localStorage.removeItem(`confirm_exp_`);
      } catch {}
      setRemainingSec(null);
      return;
    }

    // Need id + appt loaded
    if (!id || !appt) {
      setRemainingSec(null);
      return;
    }

    const key = `confirm_exp_${id}`;

    // Reuse persisted expiry so refresh won't reset
    let expiresAtMs: number | null = null;
    try {
      const raw = localStorage.getItem(key);
      const v = raw ? Number(raw) : NaN;
      if (Number.isFinite(v) && v > 0) expiresAtMs = v;
    } catch {}

    // If not persisted yet, derive from appt.created_at (fallback to now) and persist once
    if (!expiresAtMs) {
      const created = (appt as any)?.created_at ?? (appt as any)?.createdAt;
      const createdMs = created ? new Date(created).getTime() : NaN;
      const baseMs = Number.isFinite(createdMs) ? createdMs : Date.now();
      expiresAtMs = baseMs + DEPOSIT_TOTAL_SEC * 1000;

      try {
        localStorage.setItem(key, String(expiresAtMs));
      } catch {}
    }

    const tick = () => {
      const left = Math.max(0, Math.floor((expiresAtMs! - Date.now()) / 1000));
      setRemainingSec(left);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [id, appt, isPaid]);

  const cleanPhone = useMemo(() => {
    if (!payment?.whatsapp_phone_e164) return "";
    return String(payment.whatsapp_phone_e164).replace(/[^0-9]/g, "");
  }, [payment]);

  const message = useMemo(() => {
    if (!appt || !payment) return "";
    const dep = Number(appt.deposit_amount || 0);
    const when = fmtDT(appt.start_at);
    return `Selam, ben ${appt.customer_name}. ${when} randevumun ${dep} TL depozito ödemesini yaptım. Dekontu aşağıda paylaşıyorum.`;
  }, [appt, payment]);

  const waWebUrl = useMemo(() => {
    if (!cleanPhone || !message) return "";
    return `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
  }, [cleanPhone, message]);

  const waAppUrl = useMemo(() => {
    if (!cleanPhone || !message) return "";
    return `whatsapp://send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
  }, [cleanPhone, message]);

  if (loading) {
    return (
      <main className="min-h-screen bg-mc-black text-mc-bronze">
        <div className="mx-auto max-w-xl px-4 py-14 text-center text-neutral-200">Yükleniyor…</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-mc-black text-mc-bronze">
      <div className="mx-auto max-w-xl px-4 py-14">
        <div className="relative text-center">
          {showConfetti && <ConfettiBurst />}

            <div className="mb-8 flex justify-center">

          <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border border-mc-bronze/40 bg-black/30 shadow-[0_0_0_1px_rgba(192,138,90,0.20),0_0_24px_rgba(192,138,90,0.18)]">
            <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-black/40">
              <span className="absolute inset-0 rounded-full animate-pulse bg-mc-bronze/10" />
              <img
                src="/brand/logo-bronze-transparent.png"
                alt="Man Cave"
                className="relative h-20 w-20 object-contain opacity-95"
              />
            </div>
          </div>

            </div>

          <h1 className="mt-3 font-heading text-3xl sm:text-3xl sm:text-3xl sm:text-4xl text-mc-bronze">Randevunuz Oluşturuldu</h1>
          <p className="mt-2 text-sm text-neutral-300">Depozito ödemeniz sonrası randevunuz kesinleşecektir.</p>
        </div>

        {toast && (
          <div className="mt-6 rounded-xl border border-mc-bronze/30 bg-white/10 px-4 py-3 text-sm text-neutral-200">
            {toast}
          </div>
        )}

        {appt && (
          <div className="mt-8 rounded-3xl border border-white/10 bg-neutral-900 text-neutral-100 shadow-sm overflow-hidden">
            <div className="h-1 bg-mc-bronze" />
            <div className="p-6 space-y-3">
              <Row k="Tarih/Saat" v={fmtDT(appt.start_at)} />
              <Row k="Süre" v={`${Math.max(0, Math.round((new Date(appt.end_at).getTime() - new Date(appt.start_at).getTime()) / 60000))} dk`} />
              {appt.barber_name && <Row k="Berber" v={appt.barber_name} />}
              <ServiceRow summary={appt.service_summary || "—"} />
              <Row k="Toplam" v={`${appt.total_price || 0} TL`} />
              <Row k="Depozito" v={`${appt.deposit_amount || 0} TL`} strong />
            </div>
          </div>
        )}

        {payment && (
          <div className="mt-6 rounded-3xl border border-white/10 bg-neutral-900 text-neutral-100 shadow-sm overflow-hidden">
            <div className="h-1 bg-mc-bronze" />
            <div className="p-6 space-y-4">
              <div className="text-lg font-semibold">Depozito Bilgileri</div>

              {/* Countdown inside deposit card */}

                {appt && isPaid && (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200">
                    <span className="text-base">✅</span>
                    Depozito: Ödendi
                  </div>
                )}
              {appt &&
                typeof remainingSec === "number" &&
                !isPaid &&
                (remainingSec > 0 ? (
                  <div
                    className={[
                      "mt-3 rounded-2xl border px-4 py-3 text-sm text-neutral-200 transition bg-black/20",
                      remainingSec <= 300 ? "border-rose-200/40 bg-rose-50/10" : "border-mc-bronze/25 bg-white/10",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-mc-bronze">Depozito için kalan süre:</span>

                      <span
                        className={[
                          "inline-flex items-center rounded-full px-3 py-1 font-mono text-lg font-bold tracking-wide",
                          remainingSec <= 300
                            ? "bg-rose-50/20 text-rose-200 border border-rose-200/40 animate-pulse"
                            : "bg-mc-bronze/15 text-mc-bronze border border-mc-bronze/30",
                        ].join(" ")}
                      >
                        {String(Math.floor(remainingSec / 60)).padStart(2, "0")}:
                        {String(remainingSec % 60).padStart(2, "0")}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 rounded-2xl border border-amber-200/30 bg-amber-50/10 px-4 py-3 text-sm text-neutral-200">
                    <span className="font-semibold text-mc-bronze">Depozito süresi doldu.</span>{" "}
                    İşletme sizinle iletişime geçecektir.
                  </div>
                ))}

              <CopyRow label="IBAN" value={payment.iban || ""} />
              {payment.account_name && <CopyRow label="Alıcı" value={payment.account_name} />}
              <CopyRow label="Açıklama" value={`Randevu - ${appt?.customer_name} - ${fmtDT(appt?.start_at || "")}`} />
            </div>
          </div>
        )}

        {waWebUrl && (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <a
              href={waWebUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-full items-center justify-center rounded-xl px-6 py-3 bg-neutral-900 text-neutral-100 font-semibold border border-white/10 hover:border-mc-bronze hover:bg-neutral-800 transition"
            >
              WhatsApp Web’de Aç
            </a>
            <a
              href={waAppUrl}
              className="inline-flex w-full items-center justify-center rounded-xl px-6 py-3 bg-mc-bronze text-black font-semibold hover:opacity-90 transition"
            >
              Uygulamada Aç
            </a>
          </div>
        )}

        {appt && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <a
              href={(() => {
                const text = encodeURIComponent("Man Cave Randevu");
                const details = encodeURIComponent(
                  `Hizmet: ${appt.service_summary || "—"}\nDepozito: ${Number(appt.deposit_amount || 0)} TL`
                );
                const start = new Date(appt.start_at);
                const end = new Date(appt.end_at);
                const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(".000", "");
                const dates = `${fmt(start)}/${fmt(end)}`;
                return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&details=${details}&dates=${dates}`;
              })()}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-full items-center justify-center rounded-xl px-6 py-3 bg-neutral-900 text-neutral-100 font-semibold border border-white/10 hover:border-mc-bronze hover:bg-neutral-800 transition"
            >
              Google Takvime Ekle
            </a>

            <a
              href={`/api/appointment-ics?id=${encodeURIComponent(id)}`}
              className="inline-flex w-full items-center justify-center rounded-xl px-6 py-3 bg-neutral-900 text-neutral-100 font-semibold border border-white/10 hover:border-mc-bronze hover:bg-neutral-800 transition"
            >
              Apple / ICS İndir
            </a>
          </div>
        )}

        <Link href="/"  className="mt-4 block text-center text-sm text-neutral-300 underline">
          Yeni randevu oluştur
        </Link>
      </div>
    </main>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  const isDeposit = k.toLowerCase().includes("depozito");
  return (
    <div className={`flex items-center justify-between ${strong ? "font-semibold" : ""}`}>
      <span className="text-sm text-neutral-400">{k}</span>
      <span className={["text-sm text-right", isDeposit ? "text-mc-bronze font-semibold" : "text-neutral-100"].join(" ")}>
        {v}
      </span>
    </div>
  );
}

function ServiceRow({ summary }: { summary: string }) {
  const parts = (() => {
    const raw = (summary || "—").trim();
    if (raw.includes("+")) return raw.split("+").map((x) => x.trim()).filter(Boolean);
    if (raw.includes(",")) return raw.split(",").map((x) => x.trim()).filter(Boolean);
    return [raw];
  })();

  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-neutral-400">Hizmet</span>
      <div className="text-right">
        {parts.length <= 1 ? (
          <div className="text-sm text-neutral-100">{parts[0]}</div>
        ) : (
          <ul className="space-y-1 text-sm text-neutral-100">
            {parts.map((x, i) => (
              <li key={`${x}-${i}`}>• {x}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-neutral-950/40 px-4 py-3">
      <div>
        <div className="text-xs text-neutral-400">{label}</div>
        <div className="font-mono text-sm break-all">{value}</div>
      </div>
      <button
        onClick={copy}
        className={[
          "rounded-lg border px-3 py-1 text-xs transition",
          copied ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-200" : "hover:bg-white/5 border-white/10 text-neutral-200",
        ].join(" ")}
      >
        {copied ? "Kopyalandı!" : "Kopyala"}
      </button>
    </div>
  );
}

function ConfettiBurst() {
  const pieces = Array.from({ length: 18 });
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <style>{`
        @keyframes confettiFall {
          0% { transform: translateY(-10px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(160px) rotate(180deg); opacity: 0; }
        }
      `}</style>
      {pieces.map((_, i) => (
        <span
          key={i}
          className="absolute top-0 h-2 w-1.5 rounded-sm bg-mc-bronze/90"
          style={{
            left: `${(i * 100) / pieces.length}%`,
            animation: `confettiFall 1.1s ease-out forwards`,
            animationDelay: `${(i % 6) * 0.03}s`,
          }}
        />
      ))}
    </div>
  );
}
