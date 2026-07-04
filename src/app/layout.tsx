import type { Metadata, Viewport } from "next";
import { ToastProvider } from "@/shared/components/ui/toast";
import { PUBLIC_SITE } from "@/features/public/data/site-config";
import { buildPublicPageMetadata } from "@/features/public/lib/seo";
import { isProductionEnvironment } from "@/shared/lib/environment";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const base = buildPublicPageMetadata({
    title: "پیش‌بینی فوتبال",
    description: PUBLIC_SITE.description,
    path: "/",
  });
  const production = isProductionEnvironment();

  return {
    ...base,
    manifest: "/manifest.json",
    icons: {
      icon: "/logo/bordin-logo.png",
      shortcut: "/logo/bordin-logo.png",
      apple: "/logo/bordin-logo.png",
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "بُردین",
    },
    ...(production
      ? {
          other: {
            enamad: "24454912",
          },
        }
      : {}),
  };
}

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl">
      <body className="font-sans antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
