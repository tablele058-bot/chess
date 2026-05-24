import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Suspense } from "react";
import { NavBar } from "@/components/NavBar";
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
  title: "Chess",
  description: "Play chess with Stockfish AI, analyse your games, and improve your rank.",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: undefined,
        variables: {
          colorPrimary: "#10b981",
          colorBackground: "#262421",
          colorText: "#e4e4e4",
          colorInputBackground: "#312e2b",
          colorInputText: "#e4e4e4",
          borderRadius: "0.375rem",
        },
      }}
    >
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <head>
          <link rel="icon" href="/favicon.ico" sizes="any" />
          <link rel="apple-touch-icon" href="/favicon.ico" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        </head>
        <body className="min-h-full flex flex-col">
          <Suspense fallback={<div className="h-[57px] bg-[#262421] border-b border-[#3c3934]" />}><NavBar /></Suspense>
          {children}
          <script
            dangerouslySetInnerHTML={{
              __html: `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
  });
}
`,
            }}
          />
        </body>
      </html>
    </ClerkProvider>
  );
}
