// Offline repertoire of the v1.8 prototype (`src/features/Translator.jsx`): 29 terms and 3 phrases,
// original support translations ES / EN / FR, pending editorial review. Data, not an i18n catalogue.
import { normalizeText } from "../knowledge/search";

export const PHRASES: readonly (readonly [es: string, en: string, fr: string])[] = [
  ["Par de apriete", "Torque", "Couple de serrage"],
  ["Herramienta", "Tool", "Outil"],
  ["Llave dinamométrica", "Torque wrench", "Clé dynamométrique"],
  ["Combustible", "Fuel", "Carburant"],
  ["Densidad", "Density", "Masse volumique"],
  ["Tren de aterrizaje", "Landing gear", "Train d’atterrissage"],
  ["Ala", "Wing", "Aile"],
  ["Fuselaje", "Fuselage", "Fuselage"],
  ["Motor", "Engine", "Moteur"],
  ["Fuga", "Leak", "Fuite"],
  ["Inspección", "Inspection", "Inspection"],
  ["Número de pieza", "Part number", "Référence de pièce"],
  ["Número de serie", "Serial number", "Numéro de série"],
  ["Apretar", "Tighten", "Serrer"],
  ["Aflojar", "Loosen", "Desserrer"],
  ["Retirar", "Remove", "Déposer"],
  ["Instalar", "Install", "Installer"],
  ["Sustituir", "Replace", "Remplacer"],
  ["Comprobar", "Check", "Vérifier"],
  ["Daño", "Damage", "Dommage"],
  ["Holgura", "Clearance", "Jeu"],
  ["Junta", "Seal", "Joint"],
  ["Presión", "Pressure", "Pression"],
  ["Temperatura", "Temperature", "Température"],
  ["Izquierda", "Left", "Gauche"],
  ["Derecha", "Right", "Droite"],
  ["Fecha de caducidad", "Expiry date", "Date d’expiration"],
  ["Disponible", "Available", "Disponible"],
  ["Mantenimiento", "Maintenance", "Maintenance"],
  [
    "Solicito más información.",
    "I would like more information.",
    "Je souhaite obtenir plus d’informations.",
  ],
  [
    "¿Puedes confirmar las fechas?",
    "Can you confirm the dates?",
    "Pouvez-vous confirmer les dates ?",
  ],
  ["Gracias por la información.", "Thank you for the information.", "Merci pour les informations."],
];

export const TRANSLATOR_LANGS = ["es", "en", "fr"] as const;
export type TranslatorLang = (typeof TRANSLATOR_LANGS)[number];
export const TRANSLATOR_MAX_LENGTH = 2000;

const column = (lang: TranslatorLang) => TRANSLATOR_LANGS.indexOf(lang);

/** The row whose term in `from` is the text, accents, case and surrounding spaces ignored. */
export const exactPhrase = (text: string, from: TranslatorLang) =>
  PHRASES.find((row) => normalizeText(row[column(from)]!) === normalizeText(text)) ?? null;

/** Every row with no text; otherwise the rows whose term in `from` contains it (source language only). */
export const suggestPhrases = (text: string, from: TranslatorLang) =>
  text.trim() === ""
    ? PHRASES
    : PHRASES.filter((row) => normalizeText(row[column(from)]!).includes(normalizeText(text)));

export const phraseIn = (row: (typeof PHRASES)[number], lang: TranslatorLang) => row[column(lang)]!;

/** Swap keeps the text: its equivalent when it is an exact match, else the text as typed (✗ TOOL-06 #5). */
export const swappedText = (text: string, from: TranslatorLang, to: TranslatorLang) => {
  const row = exactPhrase(text, from);
  return row ? phraseIn(row, to) : text;
};

/** The external link opened only after explicit consent (no request is made by the app). */
export const externalTranslationUrl = (from: TranslatorLang, to: TranslatorLang, text: string) =>
  `https://translate.google.com/?sl=${from}&tl=${to}&text=${encodeURIComponent(text)}&op=translate`;

/** The link exists only with text, two different languages and the consent tick. */
export const canOpenExternal = (
  text: string,
  from: TranslatorLang,
  to: TranslatorLang,
  consent: boolean,
) => consent && text.trim() !== "" && from !== to;
