import BookingWidget from "@/components/BookingWidget";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-neutral-50 p-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold mb-2">
          Berber Randevu Sistemi
        </h1>
        <p className="text-gray-600 mb-6">
          Hizmet seç → tarih seç → uygun saatleri gör → randevu oluştur
        </p>

        <BookingWidget />
      </div>
    </main>
  );
}
