import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aerchain Procurement Intelligence",
  description: "Procurement intelligence workspace for corrugated packaging supplier comparison."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
