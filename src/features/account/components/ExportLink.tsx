"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, type MouseEvent } from "react";
import { buttonClass } from "@/components/ui/button-class";
import { exportFileName } from "../state";

const EXPORT_URL = "/app/settings/export";

/**
 * «Exportar mis datos y archivos» with v1.8's «Exportación preparada.» once the file is in hand. A plain
 * link without script (the route answers with an attachment); with script the file is fetched first so
 * the outcome can be told honestly — a failure comes back as the Settings page, not as JSON.
 */
/** The export as a blob, or null when the request failed or did not return JSON. Never throws. */
async function fetchExport(): Promise<Blob | null> {
  try {
    const response = await fetch(EXPORT_URL, { cache: "no-store" });
    if (!response.ok || !/json/.test(response.headers.get("content-type") ?? "")) return null;
    return await response.blob();
  } catch {
    return null;
  }
}

export function ExportLink() {
  const t = useTranslations("account.data");
  const locale = useLocale();
  const [state, setState] = useState<"idle" | "busy" | "ready" | "failed">("idle");

  async function download(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    setState("busy");
    const blob = await fetchExport();
    if (!blob) {
      setState("failed");
      return;
    }
    try {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = exportFileName(locale);
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setState("ready");
    } catch {
      setState("failed");
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <a
        href={EXPORT_URL}
        onClick={download}
        aria-busy={state === "busy"}
        className={buttonClass("secondary")}
      >
        {state === "busy" ? t("exporting") : t("export")}
      </a>
      {state === "ready" && (
        <p role="status" className="text-sm text-ok">
          {t("exportReady")}
        </p>
      )}
      {state === "failed" && (
        <p role="alert" className="text-sm text-danger">
          {t("exportFailed")}
        </p>
      )}
    </div>
  );
}
