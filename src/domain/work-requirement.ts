export const SHIFTS = ["day", "night", "split", "flexible"] as const;
export type Shift = (typeof SHIFTS)[number];

export const URGENCIES = ["planned", "urgent", "aog"] as const;
export type Urgency = (typeof URGENCIES)[number];

export const REQUIREMENT_STATUSES = ["draft", "open", "covered", "cancelled", "closed"] as const;
export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number];

export const REQUIREMENT_LEVELS = ["hard", "soft"] as const;
export type RequirementLevel = (typeof REQUIREMENT_LEVELS)[number];

export const HEADCOUNT_MAX = 50;
export const MAX_REQUIREMENT_DAYS = 366;

export interface RequiredQualification {
  qualificationTypeId: string;
  code: string;
  name: string;
  level: RequirementLevel;
}

export interface WorkRequirement {
  id: string;
  organizationId: string;
  title: string;
  location: string;
  startsAt: string;
  endsAt: string;
  shift: Shift;
  headcount: number;
  urgency: Urgency;
  status: RequirementStatus;
  createdAt: string;
  qualifications: RequiredQualification[];
}
