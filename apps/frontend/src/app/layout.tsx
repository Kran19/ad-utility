import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Utility + Ad Platform",
  description: "High-performance single-domain online utilities platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-slate-950 text-slate-100 min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}
