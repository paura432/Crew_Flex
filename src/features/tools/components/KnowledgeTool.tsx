"use client";

// English and acronyms (v1.8 `Toolbox.jsx` → `Knowledge`): ES/EN dictionary, ATA index and a short
// practice. The bank is editorial data in Spanish (`knowledge/data.ts`, 2026-10-13.1, pending formal
// review); only the interface is translated. Nothing is stored.
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  ATA,
  ENTRIES,
  KNOWLEDGE_GROUPS,
  KNOWLEDGE_SOURCES,
  KNOWLEDGE_VERSION,
  PRACTICE_CARDS,
} from "../knowledge/data";
import { filterAta, searchKnowledge } from "../knowledge/search";
import { BookOpenIcon, ChevronIcon, GraduationCapIcon, SearchIcon } from "./icons";
import {
  CopyResult,
  Footnote,
  PressedGroup,
  ToolField,
  ToolPanel,
  toolControlClass,
} from "./parts";
import { toolButtonClass } from "./tool-button";

type Tab = "terms" | "ata" | "practice";
const TABS: readonly Tab[] = ["terms", "ata", "practice"];
const heading = "text-[23px] leading-tight font-bold tracking-tight text-[#122e43]";

export function KnowledgeTool() {
  const t = useTranslations("tools.knowledge");
  const [tab, setTab] = useState<Tab>("terms");
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [card, setCard] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const selected = ENTRIES.find((e) => e.id === selectedId) ?? null;
  const practice = PRACTICE_CARDS[card % PRACTICE_CARDS.length]!;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PressedGroup
          label={t("sections")}
          value={tab}
          onChange={(next) => {
            setTab(next);
            setSelectedId(null); // as v1.8: the selection goes, the search stays
          }}
          options={TABS.map((id) => ({ value: id, label: t(`tab.${id}`) }))}
        />
        <p className="text-xs text-[#587083]">
          {t("counts", { entries: ENTRIES.length, chapters: ATA.length })}
        </p>
      </div>

      {tab === "practice" ? (
        <ToolPanel className="mx-auto max-w-[750px] text-center">
          <GraduationCapIcon size={34} className="mx-auto text-tool" />
          <p className="mt-4 text-xs font-extrabold tracking-[0.17em] text-[#157877]">
            {t("practiceKicker", {
              current: (card % PRACTICE_CARDS.length) + 1,
              total: PRACTICE_CARDS.length,
            })}
          </p>
          <h2 className={`mt-3 ${heading}`} lang="en">
            {practice.term}
          </h2>
          <p className="mt-3 text-[23px] font-semibold text-[#203d50]" lang="en">
            {practice.example}
          </p>
          <div aria-live="polite">
            {revealed && (
              <div className="my-6 rounded-[10px] bg-[#eff7f5] p-4" lang="es">
                <h3 className="text-base font-bold text-[#122e43]">{practice.translation}</h3>
                <p className="mt-2 text-sm">{practice.exampleEs}</p>
                <p className="mt-2 text-sm text-[#587083]">{practice.definition}</p>
              </div>
            )}
          </div>
          <button
            type="button"
            className={`mt-5 ${toolButtonClass(true)}`}
            onClick={() => {
              if (revealed) setCard(card + 1);
              setRevealed(!revealed);
            }}
          >
            {revealed ? t("next") : t("reveal")}
          </button>
          <div className="mt-5">
            <Footnote>{t("practiceNote")}</Footnote>
          </div>
        </ToolPanel>
      ) : (
        <>
          <div className="flex min-h-11 items-center gap-3 rounded-[9px] border border-[#cbd8df] bg-white px-4 text-[#6c8391]">
            <SearchIcon size={20} className="shrink-0" />
            <input
              type="search"
              aria-label={t("searchLabel")}
              value={query}
              autoComplete="off"
              placeholder={tab === "ata" ? t("placeholderAta") : t("placeholderTerms")}
              onChange={(e) => setQuery(e.target.value)}
              className="min-h-11 w-full min-w-0 bg-transparent text-sm text-[#173349] placeholder:text-muted"
            />
          </div>

          {tab === "ata" ? (
            <AtaIndex query={query} />
          ) : (
            <>
              <div className="max-w-xs">
                <ToolField id="knowledge-area" label={t("area")}>
                  <select
                    id="knowledge-area"
                    className={toolControlClass}
                    value={group}
                    onChange={(e) => setGroup(e.target.value)}
                  >
                    <option value="">{t("allAreas")}</option>
                    {KNOWLEDGE_GROUPS.map((g) => (
                      <option key={g} value={g} lang="es">
                        {g}
                      </option>
                    ))}
                  </select>
                </ToolField>
              </div>
              {/* List and entry side by side from 768 px; stacked below (v1.8 ≤ 520 px). */}
              <div className="grid gap-5 md:grid-cols-[1fr_1.4fr]">
                <Dictionary
                  query={query}
                  group={group || null}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
                <div className="min-w-0 md:sticky md:top-5 md:self-start">
                  <EntryDetail entry={selected} />
                </div>
              </div>
            </>
          )}
        </>
      )}

      <details className="border-t border-[#dce5e8] pt-4 text-xs text-muted">
        <summary className="flex cursor-pointer items-center font-bold text-[#226969] pointer-coarse:min-h-11">
          {t("sourcesTitle")}
        </summary>
        <div className="mt-3 space-y-3">
          <p>{t("sourcesBody", { version: KNOWLEDGE_VERSION })}</p>
          <ul className="space-y-2">
            {KNOWLEDGE_SOURCES.map((s) => (
              <li key={s.url}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center text-[#076e73] underline pointer-coarse:min-h-11"
                >
                  {s.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </details>
    </div>
  );
}

function AtaIndex({ query }: { query: string }) {
  const t = useTranslations("tools.knowledge");
  const chapters = filterAta(query);
  if (chapters.length === 0) {
    return (
      <p role="status" className="text-sm text-[#587083]">
        {t("ataEmpty")}
      </p>
    );
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" lang="es">
      {chapters.map((a) => (
        <li
          key={a.code}
          className="flex items-center gap-4 rounded-lg border border-[#dce5ea] bg-white p-4 text-xs"
        >
          <b className="text-[22px] text-[#137c79] tabular-nums">{a.code}</b>
          <span className="min-w-0 [overflow-wrap:anywhere]">{a.label}</span>
        </li>
      ))}
    </ul>
  );
}

function Dictionary({
  query,
  group,
  selectedId,
  onSelect,
}: {
  query: string;
  group: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations("tools.knowledge");
  const results = searchKnowledge(query, group);
  if (results.length === 0) {
    return (
      <p role="status" className="text-sm text-[#587083]">
        {t("empty")}
      </p>
    );
  }
  return (
    <ul
      aria-label={t("results")}
      className="max-h-[280px] overflow-auto rounded-[10px] border border-[#dce5ea] bg-white sm:max-h-[570px]"
    >
      {results.map((e) => (
        <li key={e.id} className="border-b border-[#e5ecef] last:border-b-0">
          <button
            type="button"
            aria-pressed={e.id === selectedId}
            onClick={() => onSelect(e.id)}
            className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm text-[#29495b] hover:bg-canvas aria-[pressed=true]:bg-[#e4f3ee]"
          >
            <span className="min-w-0 [overflow-wrap:anywhere]">
              <b className="block" lang="en">
                {e.term}
              </b>
              <span className="mt-0.5 block text-xs text-[#587083]" lang="es">
                {e.translation}
              </span>
            </span>
            <ChevronIcon size={17} className="shrink-0" />
          </button>
        </li>
      ))}
    </ul>
  );
}

function EntryDetail({ entry }: { entry: (typeof ENTRIES)[number] | null }) {
  const t = useTranslations("tools.knowledge");
  return (
    <ToolPanel>
      <div aria-live="polite">
        {entry ? (
          <>
            <p className="text-xs font-extrabold tracking-[0.17em] text-[#157877]" lang="es">
              {entry.group}
            </p>
            <h2 className={`mt-2 ${heading}`} lang="en">
              {entry.term}
            </h2>
            <h3 className="mt-3 text-base font-bold text-[#122e43]" lang="es">
              {entry.translation}
            </h3>
            <p className="mt-3 text-sm text-[#587083]" lang="es">
              {entry.definition}
            </p>
            {entry.example && (
              <blockquote className="my-5 border-l-[3px] border-[#268f84] bg-[#eef6f5] p-4 text-sm">
                <b lang="en">{entry.example}</b>
                <p className="mt-1" lang="es">
                  {entry.exampleEs}
                </p>
              </blockquote>
            )}
            <p className="mt-3 text-xs text-[#587083]">
              {t("entryStatus", { version: KNOWLEDGE_VERSION })}
            </p>
            <div className="mt-4">
              <CopyResult
                light
                label={t("copy")}
                text={t("copyText", {
                  term: entry.term,
                  translation: entry.translation,
                  definition: entry.definition,
                  version: KNOWLEDGE_VERSION,
                })}
              />
            </div>
          </>
        ) : (
          <>
            <BookOpenIcon size={34} className="text-tool" />
            <h2 className={`mt-3 ${heading}`}>{t("emptyTitle")}</h2>
            <p className="mt-3 text-sm text-[#587083]">{t("emptyBody")}</p>
            <p className="mt-3 text-sm text-[#587083]">{t("ataNote")}</p>
          </>
        )}
      </div>
    </ToolPanel>
  );
}
