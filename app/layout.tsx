import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SEO & GEO Visibility Dashboard",
  description: "Multi-site SEO and AI visibility monitoring for global teams.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
