import type { Metadata } from "next";
import React from "react";
import { AppProvider } from "@/store/AppProvider";
import { Nav } from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "College Compass",
  description:
    "Search, save and compare U.S. colleges with personalized admissions-fit and true-cost estimates.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Fonts load at runtime with swap + system fallbacks, so builds never depend on network access. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Newsreader:opsz,wght@6..72,500;6..72,600;6..72,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AppProvider>
          <Nav />
          <main className="min-h-screen px-4 py-6 lg:ml-60 lg:px-8 lg:py-8">
            <div className="mx-auto max-w-6xl">{children}</div>
          </main>
        </AppProvider>
      </body>
    </html>
  );
}
