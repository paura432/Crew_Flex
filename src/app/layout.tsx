import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: { default: "Crew Flex", template: "%s · Crew Flex" },
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
