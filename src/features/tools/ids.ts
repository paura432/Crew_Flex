/** v1.8 order: daily, translator, torque, [fuel], convert, knowledge, duration (L-4). */
export const TOOL_IDS = [
  "daily",
  "translator",
  "torque",
  "convert",
  "knowledge",
  "duration",
] as const;
export type ToolId = (typeof TOOL_IDS)[number];

/**
 * v1.8 «Las herramientas se pueden utilizar sin abrir una cuenta» (area 10 #10, TOOL-01 #1, T-145):
 * the tools that run entirely in the browser on bundled data. The daily challenge keeps its progress
 * under the signed-in user's id, so it stays in /app/tools.
 */
export const PUBLIC_TOOL_IDS = [
  "translator",
  "torque",
  "convert",
  "knowledge",
  "duration",
] as const;
export type PublicToolId = (typeof PUBLIC_TOOL_IDS)[number];

/** Where the workbench lives: inside the signed-in app, or the public copy. */
export const TOOLS_BASE = { app: "/app/tools", public: "/tools" } as const;
export type ToolsBase = (typeof TOOLS_BASE)[keyof typeof TOOLS_BASE];
