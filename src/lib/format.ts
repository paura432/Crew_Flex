// Display formatting. All operational times are shown in UTC (aviation convention, and
// deterministic between server and browser).
import type { Mobility, TechnicianStatus } from "@/domain/professional";
import type { RequirementStatus, Shift, Urgency } from "@/domain/work-requirement";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});
const dateTimeFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});
const fullDateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export const formatShortDate = (iso: string) => dateFmt.format(new Date(iso)).toUpperCase();
export const formatDateTime = (iso: string) => `${dateTimeFmt.format(new Date(iso))} UTC`;
export const formatDate = (isoOrDate: string) => fullDateFmt.format(new Date(isoOrDate));
export const formatPeriod = (startsAt: string, endsAt: string) =>
  `${formatShortDate(startsAt)} → ${formatShortDate(endsAt)}`;

export const SHIFT_LABEL: Record<Shift, string> = {
  day: "Day",
  night: "Night",
  split: "Split",
  flexible: "Flexible",
};

export const URGENCY_LABEL: Record<Urgency, string> = {
  planned: "Planned",
  urgent: "Urgent",
  aog: "AOG",
};

export const STATUS_LABEL: Record<RequirementStatus, string> = {
  draft: "Draft",
  open: "Open",
  covered: "Covered",
  cancelled: "Cancelled",
  closed: "Closed",
};

export const MOBILITY_LABEL: Record<Mobility, string> = {
  local: "Local (home base only)",
  national: "National",
  international: "International",
};

export const TECHNICIAN_STATUS_LABEL: Record<TechnicianStatus, string> = {
  employed: "Employed",
  contractor: "Contractor",
  between_contracts: "Between contracts",
};
