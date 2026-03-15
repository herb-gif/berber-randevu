import { DISPLAY_TZ } from "@/lib/timezone";

function partsInTZ(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = fmt.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second")),
  };
}

export function getTZDateKey(date: Date = new Date(), timeZone: string = DISPLAY_TZ): string {
  const p = partsInTZ(date, timeZone);
  const mm = String(p.month).padStart(2, "0");
  const dd = String(p.day).padStart(2, "0");
  return `${p.year}-${mm}-${dd}`;
}

export function getTZNowParts(timeZone: string = DISPLAY_TZ) {
  return partsInTZ(new Date(), timeZone);
}

export function getOffsetMinutesAt(date: Date, timeZone: string = DISPLAY_TZ): number {
  const p = partsInTZ(date, timeZone);
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUTC - date.getTime()) / 60000);
}

export function zonedDateTimeToUtcMs(
  dateYYYYMMDD: string,
  timeHHMM: string = "00:00",
  timeZone: string = DISPLAY_TZ
): number {
  const m1 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateYYYYMMDD);
  const m2 = /^(\d{2}):(\d{2})$/.exec(timeHHMM);

  if (!m1) throw new Error("Invalid date, expected YYYY-MM-DD");
  if (!m2) throw new Error("Invalid time, expected HH:MM");

  const year = Number(m1[1]);
  const month = Number(m1[2]);
  const day = Number(m1[3]);
  const hour = Number(m2[1]);
  const minute = Number(m2[2]);

  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offsetMin = getOffsetMinutesAt(new Date(naiveUtc), timeZone);
  return naiveUtc - offsetMin * 60000;
}

export function getWeekdayInTZ(dateYYYYMMDD: string, timeZone: string = DISPLAY_TZ): number {
  const utcMs = zonedDateTimeToUtcMs(dateYYYYMMDD, "12:00", timeZone);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  });
  const wd = fmt.format(new Date(utcMs));
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[wd];
}

export function hhmmOnDateToUtcIso(
  dateYYYYMMDD: string,
  timeHHMM: string,
  timeZone: string = DISPLAY_TZ
): string {
  return new Date(zonedDateTimeToUtcMs(dateYYYYMMDD, timeHHMM, timeZone)).toISOString();
}
