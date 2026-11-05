import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Private identity card",
  description: "A private, owner-controlled identity card and document vault",
  robots: { index: false, follow: false }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}