import { cookies } from "next/headers";
import AdminLogin from "./ui/AdminLogin";
import AdminDashboard from "./ui/AdminDashboard";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const isAdmin = cookieStore.get("admin_session")?.value === "1";

  return (
    <main className="min-h-screen bg-neutral-50 p-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-semibold mb-6">Admin Panel</h1>

        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <a className="rounded-lg border bg-white px-3 py-2" href="/admin/services">
            Hizmet Fiyatları
          </a>
          <a className="rounded-lg border bg-white px-3 py-2" href="/admin/laser-options">
            Lazer Bölge Fiyatları
          </a>
        </div>

        {isAdmin ? <AdminDashboard /> : <AdminLogin />}
      </div>
    </main>
  );
}
