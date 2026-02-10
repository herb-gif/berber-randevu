export type WorkWindow = {
  openMin: number;       // 09:00 => 540
  lastStartMin: number;  // normal: 20:00 => 1200, perşembe: 13:00 => 780
  closeMin: number;      // perşembe: 14:00 => 840, diğer günlerde 24:00
  isThursday: boolean;
};

// ✅ Gün hesaplaması: +03:00 öğlen üzerinden getUTCDay (kaymıyor)
function getWeekdayTR(dateYYYYMMDD: string): number {
  // 12:00 yerel saat seçiyoruz ki UTC dönüşümünde gün kaymasın
  const d = new Date(`${dateYYYYMMDD}T12:00:00+03:00`);
  return d.getUTCDay(); // 0=Pazar ... 4=Perşembe
}

export function getWorkWindow(dateYYYYMMDD: string): WorkWindow {
  const day = getWeekdayTR(dateYYYYMMDD);
  const isThursday = day === 4;

  if (isThursday) {
    return {
      openMin: 9 * 60,
      lastStartMin: 13 * 60, // son başlangıç 13:00
      closeMin: 14 * 60,     // 14:00 kapanış
      isThursday: true,
    };
  }

  return {
    openMin: 9 * 60,
    lastStartMin: 20 * 60,  // son başlangıç 20:00
    closeMin: 24 * 60,
    isThursday: false,
  };
}
