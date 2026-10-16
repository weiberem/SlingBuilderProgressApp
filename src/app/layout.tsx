import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";

const body = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Sling Builder Tracker", template: "%s · Sling Builder Tracker" },
  description: "Baufortschritt und Zulassungsdossier für Sling-Kitflugzeuge",
  applicationName: "Sling Builder Tracker",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black", title: "Sling Builder" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Setzt das gespeicherte Farbschema vor dem ersten Rendern (verhindert Flackern).
// Standard ist dunkel (Marke); «light» und «system» werden aus dem Speicher gesetzt.
const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(t==='light'||t==='system'||t==='dark'){document.documentElement.dataset.theme=t;}}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale} className={`${body.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
