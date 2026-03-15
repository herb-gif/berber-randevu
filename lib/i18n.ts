"use client";

import { useEffect, useState } from "react";

export type Lang = "tr" | "en";

const STORAGE_KEY = "mc_lang";

const dict = {
  tr: {
    brand_tagline: "Hair & Skin Care Center",
    services: "Hizmetler",
    date: "Tarih",
    show_times: "Uygun Saatleri Göster",
    checking: "Kontrol ediliyor…",
    available_times: "Uygun Saatler",
    no_times: "Bu aralıkta uygun saat yok.",
    morning: "Sabah",
    noon: "Öğle",
    evening: "Akşam",
    name_placeholder: "Ad Soyad",
    phone_placeholder: "Telefon",
    book_now: "Hemen Randevu Al",
    creating: "Oluşturuluyor…",
    pick_barber: "Berber seç",
    close: "Kapat",
    pick_service: "Hizmet seç",
    pick_date: "Tarih seç",
    pick_time: "Saat seç",
    enter_name: "Ad Soyad gir",
    enter_phone: "Telefon gir",
    pick_laser: "Lazer bölgesi seç",
    just_taken: "Bu saat az önce doldu. Lütfen başka saat seçin.",
    booking_created: "Randevunuz Oluşturuldu",
    deposit_info: "Depozito Bilgileri",
    open_in_app: "Uygulamada Aç",
    open_web: "Web’de Aç",
  },
  en: {
    brand_tagline: "Hair & Skin Care Center",
    services: "Services",
    date: "Date",
    show_times: "Show available times",
    checking: "Checking…",
    available_times: "Available times",
    no_times: "No available times in this range.",
    morning: "Morning",
    noon: "Afternoon",
    evening: "Evening",
    name_placeholder: "Full name",
    phone_placeholder: "Phone",
    book_now: "Book now",
    creating: "Creating…",
    pick_barber: "Select barber",
    close: "Close",
    pick_service: "Select a service",
    pick_date: "Select a date",
    pick_time: "Select a time",
    enter_name: "Enter your name",
    enter_phone: "Enter your phone",
    pick_laser: "Select laser area",
    just_taken: "That time was just taken. Please pick another.",
    booking_created: "Appointment created",
    deposit_info: "Deposit information",
    open_in_app: "Open in app",
    open_web: "Open on web",
  },
} as const;

export function t(lang: Lang, key: keyof typeof dict.tr) {
  return (dict[lang] as any)[key] ?? (dict.tr as any)[key] ?? String(key);
}

export function getStoredLang(): Lang {
  if (typeof window === "undefined") return "tr";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "en" ? "en" : "tr";
}

export function setStoredLang(lang: Lang) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, lang);
}

export function useLang() {
  const [lang, setLangState] = useState<Lang>("tr");

  useEffect(() => {
    setLangState(getStoredLang());
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    setStoredLang(l);
  };

  return { lang, setLang };
}
