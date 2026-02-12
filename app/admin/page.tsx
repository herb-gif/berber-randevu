import { cookies } from "next/headers";
import AdminLogin from "./ui/AdminLogin";
import AdminDashboard from "./ui/AdminDashboard";
import AdminNavTabs from "./ui/AdminNavTabs";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const isAdmin = cookieStore.get("admin_session")?.value === "1";

  return (
    <main className="min-h-screen bg-mc-black p-6 text-white">
      <div className="mx-auto max-w-5xl rounded-2xl bg-white p-6 text-black shadow-sm border border-mc-border">
        <h1 className="text-2xl font-semibold mb-6 text-mc-bronze">Admin Panel</h1>

          <AdminNavTabs />

        
          <a
            href="/admin/manual-appointment"
            className="rounded-xl px-4 py-2 text-sm bg-mc-black text-mc-bronze border border-mc-bronze hover:bg-mc-bronze hover:text-black transition"
          >
            ➕ Yeni Randevu Ekle
          </a>
{isAdmin ? <AdminDashboard /> : <AdminLogin />}
      </div>
    </main>
  );
}
