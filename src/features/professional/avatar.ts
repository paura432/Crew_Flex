// v1.8 avatar photo (N-23, T-144; `ProfileIdentity.jsx:5-17`): kept ONLY in this browser, under the
// signed-in user's id; never uploaded, never shown to anyone else. Pure helpers (tested); the component
// does the I/O.

export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;
/** v1.8 refuses images over 8000 px on either side before drawing them. */
export const PHOTO_MAX_SIDE = 8000;
/** Stored as a 320×320 JPEG at quality 0.85 (v1.8). */
export const PHOTO_SIZE = 320;
export const PHOTO_QUALITY = 0.85;

/** v1.8 key `crewflex-avatar-v1-<id>`; the id comes from the verified session, never from the URL. */
export const photoKey = (userId: string) => `crewflex-avatar-v1-${userId}`;

/** A stored value is shown only when it is an image data URL of an accepted type (v1.8 check). */
export const isStoredPhoto = (value: string | null): value is string =>
  /^data:image\/(jpeg|png|webp);base64,/.test(value ?? "");

/** Type and size, before reading the file («Elige una foto JPG, PNG o WebP de hasta 2 MB.»). */
export const acceptsPhoto = (file: { type: string; size: number }) =>
  (PHOTO_TYPES as readonly string[]).includes(file.type) && file.size <= PHOTO_MAX_BYTES;

/** The centred square of the source that becomes the avatar (v1.8 crop). */
export function centredSquare(width: number, height: number) {
  const side = Math.min(width, height);
  return { x: (width - side) / 2, y: (height - side) / 2, side };
}
