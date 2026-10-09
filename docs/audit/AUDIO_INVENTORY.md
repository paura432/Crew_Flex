# Audio inventory

Search: `*.ogg *.opus *.m4a *.mp3 *.wav` in the repo, `~` (depth 4) and `/mnt/c/Users/perfo/{Downloads,
Desktop, Documents, OneDrive, Music, Videos}` (depth 5). Two files found, both WhatsApp voice notes (Ogg
Opus, 48 kHz). Files were **not** copied into the repository.

| #   | File                                      | Location                        | Size   | Duration | Readable | Transcription                                                             | Confidence                                                                                               |
| --- | ----------------------------------------- | ------------------------------- | ------ | -------- | -------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| A1  | `WhatsApp Ptt 2026-09-28 at 13.05.23.ogg` | `/mnt/c/Users/perfo/Downloads/` | 7.5 KB | 3.3 s    | yes      | Attempted; output is a 2-word unintelligible fragment (avg logprob −0.61) | NONE — no usable content                                                                                 |
| A2  | `WhatsApp Ptt 2026-10-07 at 10.55.46.ogg` | `/mnt/c/Users/perfo/Downloads/` | 165 KB | 74.7 s   | yes      | Transcribed (Spanish, language prob. 1.00); 15 segments                   | MEDIUM for 28–75 s (avg logprob −0.18 … −0.28); LOW for 0–28 s (no-speech prob. 0.74, avg logprob −0.36) |

## Tool

No transcription tool existed on the machine (`whisper`, `ffmpeg`, `vosk` absent). `faster-whisper 1.2.1`
with the `small` model (CPU, int8) was installed in an isolated virtualenv inside the session scratchpad
(not in the repo, not system-wide), audio decoded with PyAV, VAD filter on, beam size 5. Outputs were
reviewed manually; nothing was inferred beyond what the model produced.

## Content classification

- **A1:** no content. Marked `TRANSCRIPTION_UNUSABLE`.
- **A2:** informal, personal voice note between founders about scheduling an in-person meeting, sharing
  "everything already created for the new company", constituting the company together, and meeting a
  senior aviation-industry contact "in professional mode". **No product, feature, pricing, legal or
  technical decision is stated.** Personal names, health and personal remarks are intentionally not
  reproduced here. Candidate business-context items are recorded in `FOUNDER_DECISIONS.md` with LOW
  confidence.

Status for the brief: audio inventory complete; transcription performed; no product decisions obtainable
from the available audios. The reference file named in the brief (A2) is the one transcribed.
