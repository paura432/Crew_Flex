"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import {
  acceptsPhoto,
  centredSquare,
  isStoredPhoto,
  photoKey,
  PHOTO_MAX_SIDE,
  PHOTO_QUALITY,
  PHOTO_SIZE,
} from "../avatar";

/** v1.8 `crewflex-avatar-change`: every avatar on the page follows a save or a removal. */
const CHANGE_EVENT = "crewflex-avatar-change";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function readPhoto(userId: string): string {
  try {
    const value = localStorage.getItem(photoKey(userId));
    return isStoredPhoto(value) ? value : "";
  } catch {
    return ""; // blocked storage: the initials stay
  }
}

/** Server render and first paint show the initials; a photo stored in this browser appears after hydration. */
function useStoredPhoto(userId: string) {
  return useSyncExternalStore(
    subscribe,
    () => readPhoto(userId),
    () => "",
  );
}

/**
 * v1.8 `.cf-avatar` (N-23): the photo kept in this browser, or the initials on the teal gradient.
 * Decorative (`aria-hidden`): the name is always next to it.
 */
export function ProfileAvatar({
  userId,
  initials,
  size = "lg",
}: {
  userId: string;
  initials: string;
  size?: "md" | "lg";
}) {
  const photo = useStoredPhoto(userId);
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border-[3px] border-white bg-avatar font-bold tracking-wide text-white shadow-md ${size === "lg" ? "size-20 text-2xl sm:size-[104px] sm:text-[34px]" : "size-14 text-lg"}`}
    >
      {photo ? (
        // A data URL from this browser's storage: next/image would only add a round trip.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="size-full object-cover" />
      ) : (
        initials
      )}
    </span>
  );
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * v1.8 «Añadir foto» / «Cambiar foto» / «Quitar foto» (N-23, T-144): JPG, PNG or WebP up to 2 MB,
 * centre-cropped to 320×320 JPEG and stored ONLY in this browser for this user. Nothing is uploaded.
 */
/**
 * Crops the file to a centred square, stores it as a JPEG data URL and tells the other avatars.
 * False when the image cannot be read, is too large or the browser storage refuses it. Never throws.
 */
async function storePhoto(userId: string, file: File): Promise<boolean> {
  try {
    const image = await loadImage(await readAsDataUrl(file));
    if (image.width > PHOTO_MAX_SIDE || image.height > PHOTO_MAX_SIDE) return false;
    const canvas = document.createElement("canvas");
    canvas.width = PHOTO_SIZE;
    canvas.height = PHOTO_SIZE;
    const { x, y, side } = centredSquare(image.width, image.height);
    canvas.getContext("2d")!.drawImage(image, x, y, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
    localStorage.setItem(photoKey(userId), canvas.toDataURL("image/jpeg", PHOTO_QUALITY));
    window.dispatchEvent(new Event(CHANGE_EVENT));
    return true;
  } catch {
    return false;
  }
}

export function AvatarPhotoControls({
  userId,
  labels,
}: {
  userId: string;
  labels: {
    add: string;
    change: string;
    saving: string;
    remove: string;
    note: string;
    invalid: string;
    saveFailed: string;
    removeFailed: string;
  };
}) {
  const photo = useStoredPhoto(userId);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!acceptsPhoto(file)) {
      setError(labels.invalid);
      return;
    }
    setBusy(true);
    setError("");
    const saved = await storePhoto(userId, file);
    if (!saved) setError(labels.saveFailed);
    setBusy(false);
  }

  function remove() {
    try {
      localStorage.removeItem(photoKey(userId));
      setError("");
      window.dispatchEvent(new Event(CHANGE_EVENT));
    } catch {
      setError(labels.removeFailed);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? labels.saving : photo ? labels.change : labels.add}
        </Button>
        {photo && (
          <Button size="sm" variant="ghost" onClick={remove}>
            {labels.remove}
          </Button>
        )}
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            void onFile(file);
          }}
        />
      </div>
      <p className="text-xs text-muted">{labels.note}</p>
      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
