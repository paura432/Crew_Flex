/** v1.8 `.tb-button` (42 px, 44 on touch); `primary` is the teal CTA (white on #057f7d, 4.8:1). */
export const toolButtonClass = (primary = false) =>
  `inline-flex min-h-[42px] pointer-coarse:min-h-11 items-center justify-center gap-2 rounded-lg border px-4 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50 ${
    primary
      ? "border-tool bg-tool text-white hover:brightness-95"
      : "border-[#ccd9df] bg-white text-[#1d4458] hover:bg-canvas"
  }`;
