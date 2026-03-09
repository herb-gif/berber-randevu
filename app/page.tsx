import BookingWidget from "./components/BookingWidget";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-mc-black">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="mt-8">
          <BookingWidget />
        </div>
      </div>
    </main>
  );
}
