import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Image Makeover | Salon & Beauty Academy",
  description:
    "A considered approach to beauty. Discover salon services, bridal artistry, and your next signature look at Image Makeover.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
