"use client";

// Workbench home (prototype `Toolbox.jsx` home): hero, favourites and one tile per tool, in v1.8's
// order. Fuel stays out until its technical review (D-11); the learning tools came with SCOPE-2.
// Favourites are a per-browser convenience (localStorage, like the prototype); losing them changes
// nothing else.
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useSyncExternalStore, type ReactNode } from "react";
import {
  BookOpenIcon,
  CheckIcon,
  ChevronIcon,
  ClockIcon,
  GraduationCapIcon,
  StarIcon,
  SwapIcon,
  WrenchIcon,
} from "./icons";

import { parseFavorites } from "../favorites";
import { TOOL_IDS, TOOLS_BASE, type ToolId, type ToolsBase } from "../ids";

export { TOOL_IDS, type ToolId };

const FAVORITES_KEY = "crewflex-tool-favorites";
const FAVORITES_EVENT = "crewflex-tool-favorites-change";

const ICONS: Record<ToolId, (size: number) => ReactNode> = {
  daily: (size) => <GraduationCapIcon size={size} />,
  translator: (size) => <BookOpenIcon size={size} />,
  torque: (size) => <WrenchIcon size={size} />,
  convert: (size) => <SwapIcon size={size} />,
  knowledge: (size) => <BookOpenIcon size={size} />,
  duration: (size) => <ClockIcon size={size} />,
};

function readRaw(): string {
  try {
    return localStorage.getItem(FAVORITES_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(FAVORITES_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(FAVORITES_EVENT, onChange);
  };
}

/**
 * `base` and `ids`: the public copy (/tools, T-145) links inside itself and leaves out the daily
 * challenge, whose progress needs a signed-in user.
 */
export function ToolsHome({
  base = TOOLS_BASE.app,
  ids = TOOL_IDS,
}: {
  base?: ToolsBase;
  ids?: readonly ToolId[];
}) {
  const t = useTranslations("tools");
  // Server render and first paint have no favourites; the stored ones appear after hydration.
  const shown = new Set(ids);
  const favorites = parseFavorites(useSyncExternalStore(subscribe, readRaw, () => "[]")).filter(
    (id) => shown.has(id),
  );
  const favoriteSet = new Set(favorites);

  function toggle(id: ToolId) {
    const next = favoriteSet.has(id) ? favorites.filter((x) => x !== id) : [...favorites, id];
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
    } catch {
      // Private mode / blocked storage: favourites are a convenience only.
    }
    window.dispatchEvent(new Event(FAVORITES_EVENT));
  }

  return (
    <>
      <div className="relative mb-8 grid gap-9 overflow-hidden rounded-[18px] bg-tool-hero p-6 text-white sm:p-10 min-[601px]:grid-cols-[1.2fr_1fr] lg:px-12">
        <span
          aria-hidden
          className="pointer-events-none absolute -top-52 -right-44 size-[430px] rounded-full border border-tool-ring"
        />
        <div className="relative">
          <p className="text-xs font-bold tracking-[0.2em] text-[#7bd5cc]">{t("hero.kicker")}</p>
          <h2 className="mt-4 mb-4 max-w-md text-3xl leading-tight font-bold tracking-tight sm:text-[42px]">
            {t("hero.title")}
          </h2>
          <p className="mb-6 max-w-md text-sm text-tool-hero-text">{t("hero.body")}</p>
          <Link
            href={`${base}/torque`}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-tool-mint px-4 text-xs font-bold text-tool-mint-ink hover:brightness-95"
          >
            {t("hero.cta")} <ChevronIcon size={17} />
          </Link>
        </div>
        {/* v1.8 hides the art up to 600 px (T-1). */}
        <div
          aria-hidden
          className="relative my-3 hidden flex-col items-center justify-center gap-3 border-l border-[#395768] min-[601px]:flex"
        >
          <span className="text-[40px] font-bold tracking-tight">N·m</span>
          <SwapIcon size={28} />
          <strong className="text-[44px] font-normal tracking-tighter text-tool-glow">
            lbf·in
          </strong>
          <small className="text-xs text-[#95b2c3]">{t("hero.artCaption")}</small>
        </div>
      </div>

      {favorites.length > 0 && (
        <section className="my-6" aria-labelledby="tool-favorites">
          <h2 id="tool-favorites" className="mb-3 flex items-center gap-2 text-base font-bold">
            <StarIcon size={18} /> {t("favorites")}
          </h2>
          <div className="flex flex-wrap gap-2.5">
            {ids
              .filter((id) => favoriteSet.has(id))
              .map((id) => (
                <Link
                  key={id}
                  href={`${base}/${id}`}
                  className="inline-flex min-h-10 pointer-coarse:min-h-11 items-center gap-2 rounded-lg border border-[#ccd9df] bg-white px-4 text-xs font-bold text-[#1d4458] hover:bg-canvas"
                >
                  {/* 17 px in a chip, 26 px on a tile, as v1.8 (T-2) */}
                  {ICONS[id](17)}
                  {t(`tile.${id}.title`)}
                </Link>
              ))}
          </div>
        </section>
      )}

      <div className="grid gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
        {ids.map((id) => {
          const title = t(`tile.${id}.title`);
          const favorite = favoriteSet.has(id);
          return (
            <section
              key={id}
              className="relative flex min-h-56 flex-col rounded-[13px] border border-[#dce5ea] bg-white p-6"
            >
              <button
                type="button"
                aria-pressed={favorite}
                aria-label={
                  favorite
                    ? t("favoriteRemove", { tool: title })
                    : t("favoriteAdd", { tool: title })
                }
                onClick={() => toggle(id)}
                className="absolute top-4 right-4 grid size-10 place-items-center rounded-lg pointer-coarse:size-11 text-[#78919e] hover:bg-canvas aria-[pressed=true]:text-[#bb7714]"
              >
                <StarIcon size={18} filled={favorite} />
              </button>
              <span className="inline-flex w-fit rounded-xl bg-tool-soft p-3 text-[#12716f]">
                {ICONS[id](26)}
              </span>
              <h2 className="mt-5 mb-2 text-[19px] font-bold tracking-tight text-[#122e43]">
                {title}
              </h2>
              <p className="mb-6 text-xs text-[#587083]">{t(`tile.${id}.sub`)}</p>
              <Link
                href={`${base}/${id}`}
                className="mt-auto inline-flex min-h-10 pointer-coarse:min-h-11 w-fit items-center gap-2 text-xs font-bold text-tool-strong hover:underline"
              >
                {t("open")} <ChevronIcon size={17} />
                <span className="sr-only">: {title}</span>
              </Link>
            </section>
          );
        })}
      </div>

      <div className="mt-6 flex items-center gap-3 text-[#4a857c]">
        <CheckIcon size={18} className="shrink-0" />
        {/* v1.8 `.toolbox p` sets the text in #587083 (4.8:1); the teal stays on the icon (X-10). */}
        <p className="text-xs text-[#587083]">{t("privacyNote")}</p>
      </div>
    </>
  );
}
