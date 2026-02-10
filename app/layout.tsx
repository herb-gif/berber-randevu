import "./globals.css";

export const metadata = {
  title: "Berber Randevu Sistemi",
  description: "Berber randevu sistemi",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body className="min-h-screen bg-neutral-50 text-neutral-900">
        {children}
      </body>
    </html>
  );
}
