import type { Prisma } from "@prisma/client";

// ─── Base model types ────────────────────────────────────────────────────────

export type User = Prisma.UserGetPayload<object>;

export type Resume = Prisma.ResumeGetPayload<object>;

export type Job = Prisma.JobGetPayload<object>;

export type Application = Prisma.ApplicationGetPayload<object>;

export type JobEvaluation = Prisma.JobEvaluationGetPayload<object>;

export type CoverLetter = Prisma.CoverLetterGetPayload<object>;

export type PortalConfig = Prisma.PortalConfigGetPayload<object>;

export type InterviewStory = Prisma.InterviewStoryGetPayload<object>;

export type PushSubscription = Prisma.PushSubscriptionGetPayload<object>;

export type PdfExport = Prisma.PdfExportGetPayload<object>;

// ─── Relation payloads (commonly fetched together) ───────────────────────────

export type ApplicationWithJob = Prisma.ApplicationGetPayload<{
  include: { job: true };
}>;

export type ApplicationWithJobAndEvaluation = Prisma.ApplicationGetPayload<{
  include: {
    job: { include: { evaluation: true } };
    evaluation: true;
  };
}>;

export type ApplicationWithCoverLetter = Prisma.ApplicationGetPayload<{
  include: { coverLetter: true };
}>;

export type ApplicationFull = Prisma.ApplicationGetPayload<{
  include: {
    job: { include: { evaluation: true } };
    evaluation: true;
    coverLetter: true;
    pdfExports: true;
  };
}>;

export type JobWithEvaluation = Prisma.JobGetPayload<{
  include: { evaluation: true };
}>;

export type JobFull = Prisma.JobGetPayload<{
  include: {
    evaluation: true;
    applications: true;
  };
}>;

export type ResumeWithCoverLetters = Prisma.ResumeGetPayload<{
  include: { coverLetters: true };
}>;

// ─── Enum re-exports ─────────────────────────────────────────────────────────

export type { AtsType, JobStatus, Recommendation } from "@prisma/client";

// ─── Application stage ───────────────────────────────────────────────────────
// (stored as string in DB, these are the valid values)

export type ApplicationStage =
  | "Saved"
  | "Applied"
  | "Screening"
  | "Interview"
  | "Offer"
  | "Rejected";

// ─── Parsed resume ───────────────────────────────────────────────────────────

export interface ParsedResumeExperience {
  title: string;
  company: string;
  duration: string;
  bullets: string[];
}

export interface ParsedResumeEducation {
  degree: string;
  institution: string;
  year?: string;
}

export interface ParsedResume {
  name: string;
  email?: string;
  skills: string[];
  experience: ParsedResumeExperience[];
  education: ParsedResumeEducation[];
  strengthScore: number;
  strengthFeedback: string;
}

// ─── User preferences ────────────────────────────────────────────────────────

export interface UserPreferences {
  roles?: string[];
  locations?: string[];
  workType?: string[];
  salaryMin?: number;
  industries?: string[];
}

// ─── Push notification ───────────────────────────────────────────────────────

export interface PushSubscriptionKeys {
  endpoint: string;
  p256dh: string;
  auth: string;
}

// ─── API response shapes ─────────────────────────────────────────────────────

export interface ApiError {
  error: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
