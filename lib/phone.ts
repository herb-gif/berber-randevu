export type PhoneNorm = {
  raw: string;
  e164: string; // +<digits>
  digits: string; // digits only
};

function digitsOnly(x: string) {
  return (x || "").replace(/[^0-9]/g, "");
}

/**
 * Normalize to E.164-ish (+digits).
 * Rules:
 * - Accept foreign numbers: if not country code 90, allow (10-15 digits)
 * - For Turkey: only allow 90533... or 90542... (local rule)
 * - Input can be: 0533..., 533..., 90533..., +90533..., 0031..., +31...
 */
export function normalizePhone(rawInput: string): PhoneNorm | null {
  const raw = String(rawInput || "").trim();
  if (!raw) return null;

  // handle 00 prefix
  let s = raw.replace(/\s+/g, "");
  if (s.startsWith("00")) s = s.slice(2);

  // strip leading +
  if (s.startsWith("+")) s = s.slice(1);

  let d = digitsOnly(s);
  if (!d) return null;

  // If starts with 0 and looks like TR mobile: 0 5xx .... (11 digits)
  if (d.startsWith("0") && d.length === 11 && d[1] === "5") {
    d = "90" + d.slice(1);
  }

  // If starts with 5 and length 10, assume TR mobile (533..., 542...)
  if (d.length === 10 && d.startsWith("5")) {
    d = "90" + d;
  }

  // Validate length (E164 digits typically 10-15)
  if (d.length < 10 || d.length > 15) return null;

  // Turkey special rule: only 90533 or 90542 (you requested)
  if (d.startsWith("90")) {
    const prefix3 = d.slice(2, 5); // 533 / 542
    if (!(prefix3 === "533" || prefix3 === "542")) {
      return null;
    }
  }

  return { raw, digits: d, e164: "+" + d };
}
