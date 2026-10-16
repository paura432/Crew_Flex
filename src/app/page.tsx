import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/Button";
import { LocaleSwitcher } from "@/features/preferences/components/LocaleSwitcher";

const FLOW = ["requirement", "workforce", "gap", "network", "coverage"] as const;

export default async function HomePage() {
  const [t, tCommon] = await Promise.all([getTranslations("landing"), getTranslations("common")]);
  return (
    <div className="min-h-screen bg-navy text-[#c4d3e1]">
      <main className="mx-auto flex max-w-5xl flex-col gap-12 px-4 py-16 sm:px-6 sm:py-24">
        <header className="flex items-center justify-between gap-3 text-white">
          <span className="flex items-center gap-3">
            <span
              aria-hidden
              className="grid size-10 place-items-center rounded-lg bg-accent font-black text-navy"
            >
              CF
            </span>
            <span className="text-xl font-bold tracking-tight">{tCommon("appName")}</span>
          </span>
          <LocaleSwitcher variant="compact" />
        </header>
        <section className="max-w-3xl">
          <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">
            {t("eyebrow")}
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            {t("title")}
          </h1>
          <p className="mt-5 text-lg">{t("lead")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/register" variant="primary">
              {t("createAccount")}
            </ButtonLink>
            <ButtonLink
              href="/login"
              className="border-white/20 bg-transparent text-white hover:bg-white/10"
            >
              {t("signIn")}
            </ButtonLink>
          </div>
        </section>
        <ol className="grid gap-2 sm:grid-cols-5" aria-label={t("flowLabel")}>
          {FLOW.map((step, i) => (
            <li key={step} className="rounded-lg border border-white/10 px-3 py-3 text-sm">
              <span className="block font-mono text-xs text-accent">0{i + 1}</span>
              <span className="text-white">{t(`flow.${step}`)}</span>
            </li>
          ))}
        </ol>
      </main>
    </div>
  );
}
