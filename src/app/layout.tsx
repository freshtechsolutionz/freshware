import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Freshware",
  description: "Fresh Tech Solutionz Command Center",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body
        className={[
          geistSans.variable,
          geistMono.variable,
          "h-full antialiased",
          // Premium base
          "bg-zinc-50 text-zinc-900",
          // Better text rendering
          "selection:bg-black selection:text-white",
        ].join(" ")}
      >
        {/* App background + subtle premium feel */}
        <div className="min-h-screen">
          <div className="pointer-events-none fixed inset-0 -z-10">
            <div className="absolute inset-0 bg-zinc-50" />
            <div className="absolute -top-24 left-1/2 h-72 w-[900px] -translate-x-1/2 rounded-full bg-black/5 blur-3xl" />
            <div className="absolute -bottom-24 left-1/3 h-72 w-[900px] -translate-x-1/2 rounded-full bg-black/5 blur-3xl" />
          </div>

          {/* Global typography + spacing defaults */}
          <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8">
            <div className="py-6 sm:py-8 lg:py-10">{children}</div>
          </div>
        </div>
      </body>
    </html>
  );
}
