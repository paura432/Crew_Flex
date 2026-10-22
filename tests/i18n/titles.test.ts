import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import es from "../../messages/es.json";

// The browser tab names the page with the same words as its menu entry (v1.8's breadcrumb used the
// menu label too), so «Documentos» in the menu is «Documentos · Crew Flex» in the tab.
const TITLE_FOR_NAV: Record<keyof typeof es.nav, keyof typeof es.meta | null> = {
  organization: null, // section heading, not a page
  professional: null, // section heading, not a page
  account: null, // section heading, not a page
  platform: null, // section heading, not a page
  viewAs: null, // switcher heading, not a page
  views: null, // switcher labels: checked per view below
  dashboard: "organization",
  requirements: "requirements",
  workforce: "workforce",
  overview: "professional",
  profile: "passport",
  qualifications: "qualifications",
  availability: "availability",
  settings: "settings",
  verifications: "verifications",
  tools: "tools",
  documents: "documents",
  opportunities: "opportunities",
  applications: "applications",
  logbook: "logbook",
  organizationProfile: "organizationProfile",
  administration: "admin",
  adminOrganizations: "adminOrganizations",
  audit: "audit",
};

describe("page titles match the menu", () => {
  for (const [lang, catalog] of [
    ["es", es],
    ["en", en],
  ] as const) {
    it(`${lang}: every menu page has a <title> with its menu label`, () => {
      for (const [nav, meta] of Object.entries(TITLE_FOR_NAV)) {
        if (meta === null) continue;
        expect(catalog.meta[meta], `${nav} → meta.${meta}`).toBe(
          catalog.nav[nav as keyof typeof catalog.nav],
        );
      }
      // The two pages only the «View as» switcher opens
      expect(catalog.meta.admin).toBe(catalog.nav.views.admin);
      expect(catalog.meta.recruiter).toBe(catalog.nav.views.recruiter);
    });
  }
});
