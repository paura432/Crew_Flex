"use client";

// Support translator (v1.8 `src/features/Translator.jsx`): exact matches and suggestions from a local
// ES/EN/FR repertoire, and a link to Google Translate only after an explicit consent tick that any
// change clears. The app sends nothing: no request, no storage (the text is not kept).
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  canOpenExternal,
  exactPhrase,
  externalTranslationUrl,
  phraseIn,
  PHRASES,
  suggestPhrases,
  swappedText,
  TRANSLATOR_LANGS,
  TRANSLATOR_MAX_LENGTH,
  type TranslatorLang,
} from "../translator/phrases";
import { ExternalIcon, LanguagesIcon, SwapIcon } from "./icons";
import {
  Footnote,
  SectionHead,
  ToolField,
  ToolPanel,
  toolButtonClass,
  toolControlClass,
} from "./parts";

export function TranslatorTool() {
  const t = useTranslations("tools.translator");
  // v1.8 default pair: English → Spanish (TOOL-06 #4).
  const [from, setFrom] = useState<TranslatorLang>("en");
  const [to, setTo] = useState<TranslatorLang>("es");
  const [text, setText] = useState("");
  const [consent, setConsent] = useState(false);

  // Every change withdraws the consent: it was given for one text and one pair.
  function update(next: { from?: TranslatorLang; to?: TranslatorLang; text?: string }) {
    if (next.from) setFrom(next.from);
    if (next.to) setTo(next.to);
    if (next.text !== undefined) setText(next.text);
    setConsent(false);
  }

  const exact = exactPhrase(text, from);
  const suggestions = suggestPhrases(text, from);

  const languageSelect = (id: string, value: TranslatorLang, key: "from" | "to") => (
    <ToolField id={id} label={t(key)}>
      <select
        id={id}
        className={toolControlClass}
        value={value}
        onChange={(e) => update({ [key]: e.target.value as TranslatorLang })}
      >
        {TRANSLATOR_LANGS.map((lang) => (
          <option key={lang} value={lang}>
            {t(`lang.${lang}`)}
          </option>
        ))}
      </select>
    </ToolField>
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,1fr)] lg:gap-6">
        <ToolPanel>
          <SectionHead kicker={t("kicker")} title={t("title")} icon={<LanguagesIcon size={32} />} />
          <p className="mt-3 mb-5 text-sm text-[#587083]">{t("lead")}</p>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {languageSelect("translator-from", from, "from")}
              {languageSelect("translator-to", to, "to")}
            </div>
            <button
              type="button"
              className={toolButtonClass()}
              onClick={() => update({ from: to, to: from, text: swappedText(text, from, to) })}
            >
              <SwapIcon size={16} />
              {t("swap")}
            </button>
            <ToolField id="translator-text" label={t("text")}>
              <textarea
                id="translator-text"
                rows={5}
                maxLength={TRANSLATOR_MAX_LENGTH}
                lang={from}
                className={toolControlClass}
                value={text}
                placeholder={t("placeholder")}
                aria-describedby="translator-count"
                onChange={(e) => update({ text: e.target.value })}
              />
              <p id="translator-count" className="text-xs text-muted">
                {t("counter", { count: text.length, max: TRANSLATOR_MAX_LENGTH })}
              </p>
            </ToolField>

            <div aria-live="polite">
              {exact ? (
                <div className="rounded-[13px] bg-tool-result p-6 text-white [overflow-wrap:anywhere]">
                  <p className="text-xs tracking-[0.09em] text-tool-caption uppercase">
                    {t("matchCaption")}
                  </p>
                  <p className="mt-3 text-[23px] leading-tight font-semibold" lang={to}>
                    {phraseIn(exact, to)}
                  </p>
                </div>
              ) : (
                text.trim() !== "" && <p className="text-sm text-[#587083]">{t("noMatch")}</p>
              )}
            </div>

            <details className="border-t border-[#dce5e8] pt-4 text-xs text-[#5f7788]">
              <summary className="flex cursor-pointer items-center font-bold text-[#226969] pointer-coarse:min-h-11">
                {t("externalTitle")}
              </summary>
              <div className="mt-3 space-y-4">
                <p>{t("externalNote")}</p>
                <label className="flex items-center gap-2 text-sm text-[#24465d] pointer-coarse:min-h-11">
                  <input
                    type="checkbox"
                    className="size-[17px] shrink-0 accent-tool"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  {t("consent")}
                </label>
                {canOpenExternal(text, from, to, consent) ? (
                  <a
                    href={externalTranslationUrl(from, to, text)}
                    target="_blank"
                    rel="noreferrer"
                    className={toolButtonClass()}
                  >
                    {t("open")} <ExternalIcon size={16} />
                    <span className="sr-only">{t("newTab")}</span>
                  </a>
                ) : (
                  <p className="text-xs text-muted">{t("externalHint")}</p>
                )}
              </div>
            </details>
          </div>
        </ToolPanel>

        <ToolPanel className="lg:self-start">
          <h2 className="text-[23px] leading-tight font-bold tracking-tight text-[#122e43]">
            {t("repertoireTitle")}
          </h2>
          <p className="mt-3 text-sm text-[#587083]">
            {t("repertoireBody", { count: PHRASES.length })}
          </p>
          {suggestions.length === 0 ? (
            <p role="status" className="mt-4 text-sm text-[#587083]">
              {t("noSuggestions")}
            </p>
          ) : (
            <ul className="mt-3 max-h-[520px] overflow-auto">
              {suggestions.map((row) => (
                <li key={row[0]} className="border-b border-[#e2e9ed]">
                  <button
                    type="button"
                    onClick={() => update({ text: phraseIn(row, from) })}
                    className="flex min-h-11 w-full flex-col gap-1 py-3 text-left text-sm text-[#24465d] hover:bg-canvas sm:flex-row sm:justify-between sm:gap-4"
                  >
                    <b lang={from}>{phraseIn(row, from)}</b>
                    <span className="text-[#527a7b]" lang={to}>
                      {phraseIn(row, to)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ToolPanel>
      </div>
      <Footnote>{t("footnote")}</Footnote>
    </div>
  );
}
