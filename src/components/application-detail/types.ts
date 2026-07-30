import type { ClientJob } from "@/types/client";

export interface TimelineEvent {
  type: string;
  stage?: string;
  note?: string;
  at: string;
}

export interface Contact {
  name: string;
  role?: string;
  email?: string;
  linkedin?: string;
}

export interface CoverLetterData {
  id: string;
  content: string;
  tone: string;
  versions: { content: string; tone: string; at: string }[];
  updatedAt: string;
}

export interface JobEvaluation {
  overallScore: number | null;
  recommendation: string | null;
  blockA?: { summary?: string; reason?: string } | null;
  blockB?: { strengths?: string[]; gaps?: string[] } | null;
}

// Single source of truth for the wire format; see src/types/client.ts.
export type Job = ClientJob;

export interface Application {
  id: string;
  stage: string;
  notes: string | null;
  contacts: Contact[];
  timelineEvents: TimelineEvent[];
  followUpAt: string | null;
  appliedAt: string | null;
  lastActivityAt: string;
  createdAt: string;
  job: Job | null;
  inlineJobData: { title?: string; company?: string } | null;
  coverLetter: CoverLetterData | null;
}
