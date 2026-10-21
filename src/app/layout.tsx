import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { store } from "@/lib/config";
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
  // Base para las URLs absolutas de las imágenes al compartir (WhatsApp, Facebook).
  metadataBase: new URL(store.siteUrl),
  title: { default: `${store.name} · ${store.tagline}`, template: `%s · ${store.name}` },
  description: "Perfumes originales con envío a todo el Perú. Compra fácil por WhatsApp con Yape o Plin.",
  openGraph: { siteName: store.name, locale: "es_PE", type: "website" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
