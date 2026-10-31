"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Notice, type NoticeState } from "@/components/ui/Notice";
import { actionErrorCopy, callAction } from "@/components/ui/action-result";
import { useRovingRadio } from "@/components/ui/radio-group";
import { LOCALES, type Locale } from "@/i18n/config";
import { setLocaleAction } from "../actions";

/**
 * Two presentations of the same action: `compact` (ES | EN buttons for public pages) and the
 * Settings card list. Keeps route, session and page state; only the rendered tree refreshes.
 */
export function LocaleSwitcher({
  variant = "cards",
  onDark = false,
}: {
  variant?: "cards" | "compact";
  /** Compact switcher on the navy landing: the checked option turns white (navy-on-navy read inverted). */
  onDark?: boolean;
}) {
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
    if (next === locale || pending) return;
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await callAction(() => setLocaleAction({ locale: next }));
      if (result.ok) {
        router.refresh();
        if (variant === "cards") setSaved(true);
      } else {
        setError(actionErrorCopy(tRoot, result));
      }
    });
  }

  const radio = useRovingRadio(LOCALES.length, LOCALES.indexOf(locale as Locale), (i) =>
    choose(LOCALES[i]!),
  );

  if (variant === "compact") {
    return (
      <div role="radiogroup" aria-label={t("switcherAria")} className="flex gap-1 text-xs">
        {LOCALES.map((value, i) => (
          <button
            key={value}
            {...radio(i)}
            type="button"
            role="radio"
            aria-checked={locale === value}
            lang={value}
            // aria-disabled, not disabled: a disabled button drops keyboard focus mid-switch.
            aria-disabled={pending}
            onClick={() => choose(value)}
            className={`min-h-8 pointer-coarse:min-h-11 pointer-coarse:min-w-11 rounded-md border px-2 font-semibold uppercase aria-disabled:opacity-60 ${
              onDark
                ? "border-white/40 text-white aria-checked:border-white aria-checked:bg-white aria-checked:text-navy"
                : "border-line bg-white text-muted aria-checked:border-navy aria-checked:bg-navy aria-checked:text-white"
            }`}
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
        {LOCALES.map((value, i) => {
          const selected = locale === value;
          return (
            <button
              key={value}
              {...radio(i)}
              type="button"
              role="radio"
              aria-checked={selected}
              lang={value}
              aria-disabled={pending}
              aria-busy={pending}
              onClick={() => choose(value)}
              className={`rounded-xl border p-4 text-left transition-colors hover:bg-canvas aria-disabled:opacity-60 ${
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
