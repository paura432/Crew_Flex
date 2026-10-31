import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { PublicToolId } from "./ids";

/** The tab title of a tool page: its tile title (same words as the card, W3-07). */
export async function toolMetadata(id: PublicToolId): Promise<Metadata> {
  const t = await getTranslations("tools");
  return { title: t(`tile.${id}.title`) };
}
