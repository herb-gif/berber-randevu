export type WorkWindow = {
  openMin: number;            // 09:00 => 540
  lastStartHairMin: number;   // hair için son başlangıç
  lastStartOtherMin: number;  // hair dışı için son başlangıç
  isThursday: boolean;
};

// ✅ Gün kaymasını engellemek için TR(+03) öğlen kullan
function getWeekdayTR(dateYYYYMMDD: string): number {
  const d = new Date(`${dateYYYYMMDD}T12:00:00+03:00`);
  return d.getUTCDay(); // 0=Pazar ... 4=Perşembe
}

export function getWorkWindow(dateYYYYMMDD: string): WorkWindow {
  const day = getWeekdayTR(dateYYYYMMDD);
  const isThursday = day === 4;

  // Açılış: 09:00
  const openMin = 9 * 60;

  if (isThursday) {
    return {
      openMin,
      // Perşembe: Berber 13:30 son başlangıç, diğer servisler 14:20 son başlangıç
      lastStartHairMin: 13 * 60 + 30,
      lastStartOtherMin: 14 * 60 + 20,
      isThursday: true,
    };
  }

  return {
    openMin,
    // Normal gün: Berber 20:30 son başlangıç, diğer servisler 21:00 son başlangıç
    lastStartHairMin: 20 * 60 + 30,
    lastStartOtherMin: 21 * 60,
    isThursday: false,
  };
}
