"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { actionErrorCopy, Notice, type NoticeState } from "@/components/ui/Notice";
import { LOCALES, type Locale } from "@/i18n/config";
import { setLocaleAction } from "../actions";

/**
 * Two presentations of the same action: `compact` (ES | EN buttons for public pages) and the
 * Settings card list. Keeps route, session and page state; only the rendered tree refreshes.
 */
export function LocaleSwitcher({ variant = "cards" }: { variant?: "cards" | "compact" }) {
  const locale = useLocale();
  const t = useTranslations("locale");
  const tSettings = useTranslations("settings");
  const tRoot = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<NoticeState | null>(null);
  // The success text is resolved at render time: after router.refresh() it reads in the NEW language.
  const notice: NoticeState | null =
    error ?? (saved ? { tone: "ok", text: tSettings("saved") } : null);

  function choose(next: Locale) {
    if (next === locale) return;
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await setLocaleAction({ locale: next });
      if (result.ok) {
        router.refresh();
        if (variant === "cards") setSaved(true);
      } else {
        setError(actionErrorCopy(tRoot, result));
      }
    });
  }

  if (variant === "compact") {
    return (
      <div role="radiogroup" aria-label={t("switcherAria")} className="flex gap-1 text-xs">
        {LOCALES.map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={locale === value}
            lang={value}
            disabled={pending}
            onClick={() => choose(value)}
            className="min-h-8 rounded-md border border-line bg-white px-2 font-semibold text-muted uppercase aria-checked:border-navy aria-checked:bg-navy aria-checked:text-white disabled:opacity-60"
          >
            {value}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Notice
        notice={notice}
        referenceLabel={tRoot("common.reference", { id: notice?.requestId ?? "" })}
      />
      <div role="radiogroup" aria-label={t("label")} className="grid gap-3 sm:grid-cols-2">
        {LOCALES.map((value) => {
          const selected = locale === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              lang={value}
              disabled={pending}
              aria-busy={pending}
              onClick={() => choose(value)}
              className={`rounded-xl border p-4 text-left transition-colors hover:bg-canvas disabled:opacity-60 ${
                selected ? "border-navy bg-info-bg ring-2 ring-navy" : "border-line bg-white"
              }`}
            >
              <span className="block font-semibold">{t(value)}</span>
              <span className="mt-1 block font-mono text-xs text-muted uppercase">{value}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
