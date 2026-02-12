import BookingWidget from "../components/BookingWidget";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">
          Berber Randevu Sistemi
        </h1>

        <p className="mt-2 text-sm text-neutral-600">
          Hizmet seç → tarih seç → uygun saatleri gör → randevu oluştur
        </p>

        <div className="mt-6">
          <BookingWidget />
        </div>
      </div>
    </main>
  );
}
