import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

export const metadata = {
  title: "Berber Randevu Sistemi",
  description: "Berber randevu sistemi",
};


const inter = Inter({ subsets: ["latin"], variable: "--font-body" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-heading" });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" className={`${inter.variable} ${playfair.variable}`}>
      <body className="bg-mc-black text-white font-body">
        {children}
      </body>
    </html>
  );
}
