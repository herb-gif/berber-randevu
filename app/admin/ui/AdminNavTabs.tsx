"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/admin/services", label: "Hizmet Fiyatları" },
    { href: "/admin/barbers", label: "Berberler" },
  { href: "/admin/laser-options", label: "Lazer Bölge Fiyatları" },
];

export default function AdminNavTabs() {
  const pathname = usePathname() || "";

  return (
    <div className="mt-3 flex flex-wrap gap-3 text-sm">
      {tabs.map((t) => {
        const active = pathname.startsWith(t.href);
        const cls = active
          ? "rounded-xl px-4 py-2 border border-mc-bronze bg-mc-black/80 text-mc-bronze shadow-sm shadow-mc-bronze/20 hover:bg-mc-black transition focus:outline-none focus:ring-2 focus:ring-mc-bronze/30"
          : "rounded-xl px-4 py-2 border border-white/10 bg-white/5 text-neutral-100 hover:bg-white/10 hover:border-mc-bronze hover:text-mc-bronze transition";

        return (
          <Link key={t.href} href={t.href} className={cls}>
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
