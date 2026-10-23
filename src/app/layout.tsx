import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

// v1.8 mobile dock (T-141): the page runs under the home indicator, so the dock pads itself with
// `env(safe-area-inset-bottom)` and the body with the side insets (globals.css).
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: { default: "CrewFlex", template: "%s · CrewFlex" },
    description: t("description"),
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Resolved once per request (src/i18n/request.ts): the same locale drives <html lang>,
  // Server Components and, through the provider, Client Components — no hydration mismatch.
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
