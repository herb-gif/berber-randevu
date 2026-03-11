import { DISPLAY_TZ } from "@/lib/timezone";
export type AppointmentMessageInput = {
  customerName: string;
  date: string;        // YYYY-MM-DD
  time: string;        // HH:MM
  serviceSummary: string;
  totalPrice?: number;
  depositAmount?: number;
};

export type AppointmentISOInput = {
  customerName: string;
  dateISO: string; // start_at ISO
  serviceSummary: string;
  totalPrice?: number;
  depositAmount?: number;
};

export type PaymentInfo = {
  bank_name: string;
  iban: string;
  account_name?: string | null;
  note?: string | null;
  whatsapp_phone_e164?: string | null;
};

const TZ = DISPLAY_TZ;

function formatDateTR(date: string) {
  const d = new Date(date + "T00:00:00+03:00");
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDateTimeTR(iso: string) {
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      timeZone: TZ,
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

// Basit (müşteri widgetı vb)
export function buildPaymentMessage(input: AppointmentMessageInput) {
  return `Merhaba ${input.customerName},

Randevunuz oluşturuldu:

📅 Tarih: ${formatDateTR(input.date)}
⏰ Saat: ${input.time}
💈 Hizmet: ${input.serviceSummary}
💰 Toplam: ${input.totalPrice ?? 0} TL
💳 Depozito: ${input.depositAmount ?? 0} TL

Depozito ödemenizi yaptıktan sonra randevunuz kesinleşecektir.

Teşekkür ederiz 🙏`;
}

export function buildApprovalMessage(input: AppointmentMessageInput) {
  return `Merhaba ${input.customerName},

Randevunuz onaylanmıştır ✅

📅 Tarih: ${formatDateTR(input.date)}
⏰ Saat: ${input.time}
💈 Hizmet: ${input.serviceSummary}

📍 Konum
https://maps.app.goo.gl/oLb8EAMRXNK77TPp6?g_st=ic

Sizi bekliyoruz 🙌`;
}

export function buildReminderMessage(input: AppointmentMessageInput) {
  return `Merhaba ${input.customerName},

Randevunuzu hatırlatmak isteriz ⏰

📅 Tarih: ${formatDateTR(input.date)}
⏰ Saat: ${input.time}
💈 Hizmet: ${input.serviceSummary}

Görüşmek üzere 🙏`;
}

// Admin panel: IBAN/Alıcı/Açıklama içeren depozito mesajı
export function buildDepositPaymentMessage(appt: AppointmentISOInput, payment: PaymentInfo) {
  const when = formatDateTimeTR(appt.dateISO);
  const acc = payment.account_name ? `👤 Alıcı: ${payment.account_name}\n` : "";
  const note = payment.note ? `📝 Not: ${payment.note}\n` : "";

  return (
`Merhaba ${appt.customerName} 👋

Randevunuz oluşturuldu. Depozito bilgileri aşağıdadır:

📅 Tarih/Saat: ${when}
💈 Hizmet: ${appt.serviceSummary}
💳 Depozito: ${appt.depositAmount ?? 0} TL

🏦 Banka: ${payment.bank_name}
🔢 IBAN: ${payment.iban}
${acc}${note}📝 Açıklama: Randevu - ${appt.customerName} - ${when}

📎 Ödeme yaptıktan sonra dekontu bu WhatsApp hattına gönderir misiniz?

📍 Konum
https://maps.app.goo.gl/oLb8EAMRXNK77TPp6?g_st=ic

Teşekkür ederiz 🙏`
  );
}

export function buildWhatsAppWebUrl(phoneE164: string, message: string) {
  const clean = (phoneE164 || "").replace(/[^0-9]/g, "");
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${clean}?text=${encoded}`;
}
