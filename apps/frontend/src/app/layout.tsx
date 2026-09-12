import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UtilityPlatform — Free, Fast & Secure Online Web Utilities",
  description: "Everyday utilities for images, PDFs, text, video, audio, QR codes, and AI writing. 100% private, super fast, and always free.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="antialiased bg-[#FAFBFD] text-slate-900 min-h-screen flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900">
        {children}
      </body>
    </html>
  );
}
