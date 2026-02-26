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
          ? "rounded-xl px-4 py-2 border border-mc-bronze bg-mc-black text-mc-bronze"
          : "rounded-xl px-4 py-2 border border-mc-border bg-white text-mc-dark hover:border-mc-bronze transition";

        return (
          <Link key={t.href} href={t.href} className={cls}>
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
