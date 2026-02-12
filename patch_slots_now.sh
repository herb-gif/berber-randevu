#!/usr/bin/env bash
set -euo pipefail

BUFFER_MIN=0   # istersen 15 yap: BUFFER_MIN=15

echo "==> [1/3] Frontend patch: BookingWidget (today past slots filter + disable)"

BW="app/components/BookingWidget.tsx"
if [[ ! -f "$BW" ]]; then
  echo "ERROR: $BW bulunamadı"
  exit 1
fi

cp "$BW" "$BW.bak_slots_now"

# 1) helper function ekle (addMinutesToHHMM sonrası)
if ! rg -n "function isPastSlot\\(" "$BW" >/dev/null; then
  perl -0777 -i -pe '
s/(function addMinutesToHHMM[\s\S]*?\n\}\n)/$1\nfunction isPastSlot(selectedDateISO: string, hhmm: string, bufferMin = 0) {\n  if (!selectedDateISO) return false;\n\n  const now = new Date();\n  const todayISO = now.toISOString().slice(0, 10);\n  if (selectedDateISO !== todayISO) return false;\n\n  const m = /^(\\d{1,2}):(\\d{2})$/.exec(String(hhmm || \"\").trim());\n  if (!m) return false;\n\n  const h = Number(m[1]);\n  const min = Number(m[2]);\n\n  const slot = new Date(now);\n  slot.setHours(h, min, 0, 0);\n\n  const cutoff = new Date(now.getTime() + bufferMin * 60 * 1000);\n  return slot <= cutoff;\n}\n\n/s
' "$BW"
fi

# 2) filteredSlots memo ekle (slots state’inden sonra ya da picked state’ine yakın)
if ! rg -n "const filteredSlots" "$BW" >/dev/null; then
  perl -0777 -i -pe '
s/(const\s+\[slots,\s*setSlots\]\s*=\s*useState<[^>]*>\([^;]*\);\s*\n\s*const\s+\[picked,\s*setPicked\]\s*=\s*useState<[^>]*>\([^;]*\);\s*)/$1\n\n  const filteredSlots = useMemo(\n    () => slots.filter((s) => !isPastSlot(date, s, '"$ENV{BUFFER_MIN}"')),\n    [slots, date]\n  );\n/s
' BUFFER_MIN="$BUFFER_MIN" "$BW"
fi

# 3) render’da slots.map -> filteredSlots.map
perl -0777 -i -pe '
s/\{slots\.map\(/\{filteredSlots\.map\(/g
' "$BW"

# 4) slot button disabled + onClick guard ekle (setPicked(s) görünen yerde)
#    past slot: disabled, opacity, cursor-not-allowed
if rg -n "onClick=\\{\\(\\) => setPicked\\(s\\)\\}" "$BW" >/dev/null; then
  perl -0777 -i -pe '
s/onClick=\{\(\) => setPicked\(s\)\}/onClick={() => {\n                    const past = isPastSlot(date, s, '"$BUFFER_MIN"');\n                    if (past) return;\n                    setPicked(s);\n                  }}/g;

s/<button(\s+[^>]*key=\{s\}[^>]*)(\s+onClick=\{[\s\S]*?\})([^>]*?)className=\{`([^`]+)`\}/<button$1 $2 disabled={isPastSlot(date, s, '"$BUFFER_MIN"')} $3 className={`$4 ${isPastSlot(date, s, '"$BUFFER_MIN"') ? " opacity-40 cursor-not-allowed" : ""}`}/gms;
' "$BW"
fi

echo "✅ Frontend OK. Backup: $BW.bak_slots_now"
echo
echo "==> [2/3] Backend auto-detect (safe): slot route + booking route"

API_DIR="app/api"
if [[ ! -d "$API_DIR" ]]; then
  echo "WARN: $API_DIR yok, backend patch atlanıyor."
  exit 0
fi

# SLOT route adaylarını bul: JSON’da "slots" dönen route
mapfile -t SLOT_CANDS < <(rg -l 'slots\s*[:=]' "$API_DIR" || true)
# BOOK route adaylarını bul: start_at / picked / date gibi alan kullanan POST route
mapfile -t BOOK_CANDS < <(rg -l 'start_at|startAt|picked|appointment|randevu' "$API_DIR" || true)

echo "Slot route candidates: ${#SLOT_CANDS[@]}"
printf '%s\n' "${SLOT_CANDS[@]:-}" | sed 's/^/ - /'

echo "Booking route candidates: ${#BOOK_CANDS[@]}"
printf '%s\n' "${BOOK_CANDS[@]:-}" | sed 's/^/ - /'

echo
echo "==> [3/3] Backend patch only if uniquely identified (to avoid breaking things)"

# Slot patch: sadece 1 dosya varsa ve içinde slots dizisi benzeri varsa uygula
if [[ ${#SLOT_CANDS[@]} -eq 1 ]]; then
  SF="${SLOT_CANDS[0]}"
  cp "$SF" "$SF.bak_slots_now"
  # çok konservatif: sadece "const slots" veya "let slots" varsa, bugün için filtre fonksiyonu ekle
  perl -0777 -i -pe '
if ($_ =~ /\\b(const|let)\\s+slots\\b/) {
  # helper ekle (yoksa)
  if ($_ !~ /function\\s+filterPastSlotsToday\\(/) {
    $_ = "function filterPastSlotsToday(dateISO, slots, bufferMin = 0) {\\n  try {\\n    const now = new Date();\\n    const todayISO = now.toISOString().slice(0,10);\\n    if (String(dateISO||\"\") !== todayISO) return slots;\\n    const cutoff = new Date(now.getTime() + bufferMin*60*1000);\\n    return (slots||[]).filter((hhmm) => {\\n      const m = /^(\\\\d{1,2}):(\\\\d{2})$/.exec(String(hhmm||\"\").trim());\\n      if (!m) return true;\\n      const h = Number(m[1]);\\n      const mi = Number(m[2]);\\n      const d = new Date(now);\\n      d.setHours(h, mi, 0, 0);\\n      return d > cutoff;\\n    });\\n  } catch {\\n    return slots;\\n  }\\n}\\n\\n" . $_;
  }
  # dateISO değişkeni tahmini: query param date veya body.date
  # Eğer "const date = ..." görürsek, onunla uygula
  $_ =~ s/(\\bconst\\s+date\\b[^;]*;)/$1\\n\\n  // AUTO: drop past slots today\\n  try {\\n    slots = filterPastSlotsToday(date, slots, '"$BUFFER_MIN"');\\n  } catch {}\\n/s if $_ =~ /\\bconst\\s+date\\b/;
}
' "$SF"
  echo "✅ Backend slot route patched: $SF (backup: $SF.bak_slots_now)"
else
  echo "⚠️ Backend slot patch: unique file not found -> skipped (safe)."
fi

# Booking patch: sadece 1 dosya varsa ve içinde date+picked/start_at işaretleri varsa uygula
if [[ ${#BOOK_CANDS[@]} -eq 1 ]]; then
  BF="${BOOK_CANDS[0]}"
  cp "$BF" "$BF.bak_slots_now"
  # konservatif guard: body.date + body.picked varsa, past reject ekle
  perl -0777 -i -pe '
if ($_ =~ /\\bPOST\\b/ && $_ =~ /date/ && $_ =~ /picked/) {
  if ($_ !~ /AUTO_PAST_SLOT_GUARD/) {
    $_ =~ s/(const\\s+body\\s*=\\s*await\\s+req\\.json\\(\\);)/$1\\n\\n  // AUTO_PAST_SLOT_GUARD\\n  try {\\n    const dateISO = String(body.date || \"\");\\n    const hhmm = String(body.picked || \"\");\\n    const now = new Date();\\n    const todayISO = now.toISOString().slice(0,10);\\n    if (dateISO === todayISO) {\\n      const m = /^(\\\\d{1,2}):(\\\\d{2})$/.exec(hhmm.trim());\\n      if (m) {\\n        const h = Number(m[1]);\\n        const mi = Number(m[2]);\\n        const slot = new Date(now);\\n        slot.setHours(h, mi, 0, 0);\\n        const cutoff = new Date(now.getTime() + '"$BUFFER_MIN"'*60*1000);\\n        if (slot <= cutoff) {\\n          return Response.json({ error: \"Bu saat artık geçmiş. Lütfen yeni bir saat seçin.\" }, { status: 400 });\\n        }\\n      }\\n    }\\n  } catch {}\\n/s;
  }
}
' "$BF"
  echo "✅ Backend booking route patched: $BF (backup: $BF.bak_slots_now)"
else
  echo "⚠️ Backend booking patch: unique file not found -> skipped (safe)."
fi

echo
echo "Done."
