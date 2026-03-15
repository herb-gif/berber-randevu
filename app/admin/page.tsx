import { cookies } from "next/headers";
import AdminLogin from "./ui/AdminLogin";
import AdminDashboard from "./ui/AdminDashboard";
import AdminNavTabs from "./ui/AdminNavTabs";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const isAdmin = cookieStore.get("admin_session")?.value === "1";

  return (
    <main className="min-h-screen bg-neutral-950 p-3 md:p-6 text-neutral-100">
      <div className="mx-auto max-w-5xl rounded-2xl bg-neutral-900 p-3 md:p-6 text-neutral-100 shadow-sm border border-white/10">
        <h1 className="hidden md:block text-2xl font-semibold mb-6 text-mc-bronze">Admin Panel</h1>

          <div className="hidden md:block"><AdminNavTabs /></div>

        
          <a
            href="/admin/manual-appointment"
            className="hidden md:inline-flex rounded-xl px-4 py-2 text-sm bg-mc-black text-mc-bronze border border-mc-bronze hover:bg-mc-bronze hover:text-neutral-100 transition"
          >
            ➕ Yeni Randevu Ekle
          </a>
{isAdmin ? <AdminDashboard /> : <AdminLogin />}
          {isAdmin && (
            <a
              href="/admin/manual-appointment"
              className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full border border-mc-bronze bg-mc-black text-2xl text-mc-bronze shadow-lg shadow-black/30 transition hover:bg-mc-bronze hover:text-neutral-100 md:hidden"
              aria-label="Yeni Randevu Ekle"
              title="Yeni Randevu Ekle"
            >
              +
            </a>
          )}
      </div>
    </main>
  );
}
