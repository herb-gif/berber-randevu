import { getWeekdayInTZ } from "@/lib/datetime";

export type WorkWindow = {
  openMin: number;            // 09:00 => 540
  lastStartHairMin: number;   // hair için son başlangıç
  lastStartOtherMin: number;  // hair dışı için son başlangıç
  isThursday: boolean;
};

export function getWorkWindow(dateYYYYMMDD: string): WorkWindow {
  const day = getWeekdayInTZ(dateYYYYMMDD);
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
