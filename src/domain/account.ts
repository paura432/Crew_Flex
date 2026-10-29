// Own data rights (PKG account: v1.8 «Exportar mis datos y archivos», `server/app.mjs:176`; M-3 default
// T-43). Pure rules shared by the `account` Edge Function and its tests.

/**
 * Wallet files travel inside the export as base64 (v1.8) while their total stays at or under this size;
 * the rest are listed with their metadata (download them from «Documentos»). It keeps the JSON a
 * browser download a hosting platform can serve (4.5 MB response cap, base64 adds a third).
 */
export const EXPORT_FILES_MAX_BYTES = 3 * 1024 * 1024;

/** Which documents carry their bytes: oldest first, each one that still fits; deterministic. */
export function filesToEmbed(
  documents: readonly { id: string; sizeBytes: number }[],
  maxBytes: number = EXPORT_FILES_MAX_BYTES,
): Set<string> {
  const embedded = new Set<string>();
  let total = 0;
  for (const document of documents) {
    if (document.sizeBytes < 0 || total + document.sizeBytes > maxBytes) continue;
    total += document.sizeBytes;
    embedded.add(document.id);
  }
  return embedded;
}
